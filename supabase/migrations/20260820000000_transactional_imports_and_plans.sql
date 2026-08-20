-- Import confirmation is one transaction: no partially imported catalog can be scheduled.
UPDATE public.imports SET status = 'confirmed' WHERE status = 'ready';
ALTER TABLE public.imports ALTER COLUMN status SET DEFAULT 'review';
ALTER TABLE public.imports
  ADD CONSTRAINT imports_source_type_check
    CHECK (source_type IN ('paste', 'csv', 'json', 'image', 'manual')),
  ADD CONSTRAINT imports_status_check
    CHECK (status IN ('draft', 'review', 'confirmed', 'failed'));

ALTER TABLE public.student_courses
  ADD COLUMN IF NOT EXISTS term_label text,
  ADD COLUMN IF NOT EXISTS grade numeric,
  ADD COLUMN IF NOT EXISTS completed_at date;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- At most one final schedule per user. Normalize legacy rows before enforcing it.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS position
  FROM public.plans
  WHERE is_final
)
UPDATE public.plans SET is_final = false
WHERE id IN (SELECT id FROM ranked WHERE position > 1);
CREATE UNIQUE INDEX plans_one_final_per_user_idx ON public.plans (user_id) WHERE is_final;

UPDATE public.course_sections SET gender = 'mixed'
WHERE gender NOT IN ('male', 'female', 'mixed');
UPDATE public.profiles SET gender = NULL
WHERE gender IS NOT NULL AND gender NOT IN ('male', 'female');
ALTER TABLE public.course_sections
  ADD CONSTRAINT course_sections_gender_check CHECK (gender IN ('male', 'female', 'mixed'));
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female'));

CREATE OR REPLACE FUNCTION public.confirm_catalog_import(
  p_raw_input text,
  p_source_type text,
  p_stats jsonb,
  p_sections jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_import uuid;
  v_course uuid;
  v_course_record jsonb;
  v_section jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;
  IF p_source_type NOT IN ('paste', 'csv', 'json', 'image', 'manual') THEN
    RAISE EXCEPTION 'invalid_source_type';
  END IF;
  IF jsonb_typeof(p_sections) <> 'array' OR jsonb_array_length(p_sections) = 0 THEN
    RAISE EXCEPTION 'sections_required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_sections) item
    WHERE nullif(btrim(item->>'course_code'), '') IS NULL
       OR nullif(btrim(item->>'course_name'), '') IS NULL
       OR nullif(btrim(item->>'group_number'), '') IS NULL
       OR COALESCE((item->>'units')::integer, 0) NOT BETWEEN 1 AND 12
       OR jsonb_typeof(item->'meetings') <> 'array'
       OR jsonb_array_length(item->'meetings') = 0
  ) THEN
    RAISE EXCEPTION 'invalid_section_payload';
  END IF;

  INSERT INTO public.imports (user_id, raw_input, source_type, status, stats)
  VALUES (v_user, COALESCE(p_raw_input, ''), p_source_type, 'confirmed', COALESCE(p_stats, '{}'::jsonb))
  RETURNING id INTO v_import;

  -- Replacing the owned catalog also removes stale sections and course choices.
  DELETE FROM public.courses WHERE owner_id = v_user;

  FOR v_course_record IN
    SELECT jsonb_build_object(
      'code', item->>'course_code',
      'name', max(item->>'course_name'),
      'units', max((item->>'units')::integer)
    )
    FROM jsonb_array_elements(p_sections) item
    GROUP BY item->>'course_code'
    ORDER BY item->>'course_code'
  LOOP
    INSERT INTO public.courses (
      owner_id, import_id, code, name_en, name_fa, credits, department, course_type,
      repeatable, prerequisites, corequisites
    ) VALUES (
      v_user, v_import, v_course_record->>'code', v_course_record->>'name',
      v_course_record->>'name', (v_course_record->>'units')::integer,
      'Imported', 'core', false, NULL, NULL
    ) RETURNING id INTO v_course;

    FOR v_section IN
      SELECT item
      FROM jsonb_array_elements(p_sections) item
      WHERE item->>'course_code' = v_course_record->>'code'
      ORDER BY item->>'group_number', item->>'professor'
    LOOP
      INSERT INTO public.course_sections (
        owner_id, import_id, course_id, section_name, group_number, gender,
        professor, capacity, location, meetings, exam_date, exam_date_label,
        exam_start, exam_end
      ) VALUES (
        v_user, v_import, v_course, v_section->>'group_number',
        v_section->>'group_number', COALESCE(v_section->>'gender', 'mixed'),
        NULLIF(v_section->>'professor', ''), NULLIF(v_section->>'capacity', '')::integer,
        NULLIF(v_section->>'location', ''), v_section->'meetings',
        CASE
          WHEN v_section->'exam'->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            THEN (v_section->'exam'->>'date')::date
          ELSE NULL
        END,
        COALESCE(
          NULLIF(v_section->'exam'->>'label', ''),
          NULLIF(v_section->'exam'->>'date', '')
        ),
        NULLIF(v_section->'exam'->>'start', ''), NULLIF(v_section->'exam'->>'end', '')
      );
    END LOOP;
  END LOOP;

  RETURN v_import;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_catalog_import(text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_catalog_import(text, text, jsonb, jsonb) TO authenticated;

-- Replacing academic history is also atomic: a failed insert cannot leave an empty record.
CREATE OR REPLACE FUNCTION public.replace_student_courses(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'rows_must_be_array'; END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rows) item
    WHERE nullif(btrim(item->>'course_code'), '') IS NULL
       OR item->>'status' NOT IN ('passed', 'current', 'failed', 'required', 'avoid')
       OR (
         item ? 'override_eligible'
         AND jsonb_typeof(item->'override_eligible') NOT IN ('boolean', 'null')
       )
  ) THEN
    RAISE EXCEPTION 'invalid_student_course_payload';
  END IF;

  DELETE FROM public.student_courses WHERE user_id = v_user;
  INSERT INTO public.student_courses (user_id, course_code, status, override_eligible)
  SELECT DISTINCT
    v_user,
    btrim(item->>'course_code'),
    item->>'status',
    (item->>'override_eligible')::boolean
  FROM jsonb_array_elements(p_rows) item;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_student_courses(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_student_courses(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_final_plan(p_label text, p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plan uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF jsonb_typeof(p_data) <> 'object' THEN RAISE EXCEPTION 'invalid_plan_snapshot'; END IF;
  UPDATE public.plans SET is_final = false WHERE user_id = v_user AND is_final;
  INSERT INTO public.plans (user_id, label, is_final, data)
  VALUES (v_user, NULLIF(btrim(p_label), ''), true, p_data)
  RETURNING id INTO v_plan;
  RETURN v_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.save_final_plan(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_final_plan(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_final_plan(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = p_plan_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;
  UPDATE public.plans SET is_final = false WHERE user_id = v_user AND is_final;
  UPDATE public.plans SET is_final = true WHERE id = p_plan_id AND user_id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.set_final_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_final_plan(uuid) TO authenticated;
