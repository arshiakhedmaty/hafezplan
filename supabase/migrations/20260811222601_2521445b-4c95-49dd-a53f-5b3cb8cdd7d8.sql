-- profiles
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  display_name text,
  major text,
  degree text,
  semester integer,
  min_credits integer NOT NULL DEFAULT 12,
  max_credits integer NOT NULL DEFAULT 20,
  language text NOT NULL DEFAULT 'fa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- courses (owner_id NULL = shared sample catalog)
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  code text NOT NULL,
  name_en text NOT NULL,
  name_fa text NOT NULL,
  credits integer NOT NULL DEFAULT 3,
  department text,
  course_type text NOT NULL DEFAULT 'core',
  repeatable boolean NOT NULL DEFAULT false,
  prerequisites jsonb,
  corequisites jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX courses_owner_code_idx ON public.courses (COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read shared or own courses" ON public.courses FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "insert own courses" ON public.courses FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "update own courses" ON public.courses FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "delete own courses" ON public.courses FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- sections
CREATE TABLE public.course_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  professor text,
  capacity integer,
  location text,
  meetings jsonb NOT NULL DEFAULT '[]'::jsonb,
  exam_date date,
  exam_start text,
  exam_end text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_sections_course_idx ON public.course_sections (course_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_sections TO authenticated;
GRANT ALL ON public.course_sections TO service_role;
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read shared or own sections" ON public.course_sections FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "insert own sections" ON public.course_sections FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "update own sections" ON public.course_sections FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "delete own sections" ON public.course_sections FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- student course status
CREATE TABLE public.student_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_code text NOT NULL,
  status text NOT NULL,
  override_eligible boolean,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_courses_status_check CHECK (status IN ('passed','current','failed','required','avoid')),
  CONSTRAINT student_courses_unique UNIQUE (user_id, course_code, status)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_courses TO authenticated;
GRANT ALL ON public.student_courses TO service_role;
ALTER TABLE public.student_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own student courses" ON public.student_courses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- preferences
CREATE TABLE public.student_preferences (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_preferences TO authenticated;
GRANT ALL ON public.student_preferences TO service_role;
ALTER TABLE public.student_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferences" ON public.student_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- saved plans
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text,
  is_final boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plans_user_idx ON public.plans (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plans" ON public.plans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- sample catalog
INSERT INTO public.courses (owner_id, code, name_en, name_fa, credits, department, course_type, prerequisites, corequisites) VALUES
  (NULL,'MTH101','Calculus I','ریاضی عمومی ۱',3,'Mathematics','core',NULL,NULL),
  (NULL,'MTH102','Calculus II','ریاضی عمومی ۲',3,'Mathematics','core','{"type":"course","code":"MTH101"}'::jsonb,NULL),
  (NULL,'PHY101','General Physics I','فیزیک عمومی ۱',3,'Physics','core',NULL,NULL),
  (NULL,'PHY102','General Physics II','فیزیک عمومی ۲',3,'Physics','core','{"type":"course","code":"PHY101"}'::jsonb,NULL),
  (NULL,'PHY150','Physics Laboratory','آزمایشگاه فیزیک',1,'Physics','lab',NULL,'{"type":"course","code":"PHY102"}'::jsonb),
  (NULL,'PHY201','Electromagnetism I','الکترومغناطیس ۱',3,'Physics','core','{"type":"and","items":[{"type":"course","code":"PHY102"},{"type":"course","code":"MTH102"}]}'::jsonb,NULL),
  (NULL,'PHY202','Quantum Mechanics I','مکانیک کوانتومی ۱',3,'Physics','core','{"type":"and","items":[{"type":"course","code":"PHY102"},{"type":"course","code":"MTH102"}]}'::jsonb,NULL),
  (NULL,'PHY203','Thermodynamics I','ترمودینامیک ۱',3,'Physics','core','{"type":"course","code":"PHY101"}'::jsonb,NULL),
  (NULL,'PHY301','Quantum Mechanics II','مکانیک کوانتومی ۲',3,'Physics','core','{"type":"course","code":"PHY202"}'::jsonb,NULL),
  (NULL,'MTH210','Mathematical Physics','فیزیک ریاضی',3,'Mathematics','elective','{"type":"or","items":[{"type":"course","code":"MTH102"},{"type":"course","code":"PHY102"}]}'::jsonb,NULL),
  (NULL,'GEN110','Persian Literature','ادبیات فارسی',2,'General','general',NULL,NULL),
  (NULL,'GEN120','Academic Ethics','اخلاق حرفه‌ای',2,'General','general',NULL,NULL);

INSERT INTO public.course_sections (owner_id, course_id, section_name, professor, capacity, location, meetings, exam_date, exam_start, exam_end)
SELECT NULL, c.id, v.section_name, v.professor, v.capacity, v.location, v.meetings::jsonb, v.exam_date::date, v.exam_start, v.exam_end
FROM (VALUES
  ('PHY201','01','Dr. Rastgar',35,'Hall A','[{"day":0,"start":"08:00","end":"10:00"},{"day":2,"start":"08:00","end":"10:00"}]','2026-06-16','09:00','11:00'),
  ('PHY201','02','Dr. Kaviani',30,'Hall B','[{"day":1,"start":"10:00","end":"12:00"},{"day":3,"start":"10:00","end":"12:00"}]','2026-06-16','09:00','11:00'),
  ('PHY202','01','Dr. Sadeghi',40,'Hall A','[{"day":0,"start":"10:00","end":"12:00"},{"day":2,"start":"10:00","end":"12:00"}]','2026-06-18','09:00','11:00'),
  ('PHY202','02','Dr. Nourani',25,'Hall C','[{"day":1,"start":"08:00","end":"10:00"},{"day":3,"start":"08:00","end":"10:00"}]','2026-06-18','09:00','11:00'),
  ('PHY203','01','Dr. Amini',35,'Hall B','[{"day":1,"start":"14:00","end":"16:00"},{"day":3,"start":"14:00","end":"16:00"}]','2026-06-20','09:00','11:00'),
  ('PHY203','02','Dr. Amini',35,'Hall B','[{"day":4,"start":"08:00","end":"11:00"}]','2026-06-20','09:00','11:00'),
  ('MTH210','01','Dr. Tehrani',30,'Hall D','[{"day":0,"start":"14:00","end":"16:00"},{"day":2,"start":"14:00","end":"16:00"}]','2026-06-22','09:00','11:00'),
  ('MTH210','02','Dr. Yazdi',30,'Hall D','[{"day":4,"start":"14:00","end":"17:00"}]','2026-06-22','09:00','11:00'),
  ('PHY150','01','Dr. Karimi',18,'Lab 1','[{"day":2,"start":"16:00","end":"18:00"}]',NULL,NULL,NULL),
  ('PHY150','02','Dr. Karimi',18,'Lab 1','[{"day":4,"start":"16:00","end":"18:00"}]',NULL,NULL,NULL),
  ('GEN110','01','Dr. Shirazi',60,'Hall E','[{"day":0,"start":"16:00","end":"18:00"}]','2026-06-24','09:00','11:00'),
  ('GEN110','02','Dr. Shirazi',60,'Hall E','[{"day":3,"start":"16:00","end":"18:00"}]','2026-06-24','09:00','11:00'),
  ('GEN120','01','Dr. Mousavi',60,'Hall E','[{"day":1,"start":"16:00","end":"18:00"}]','2026-06-25','09:00','11:00'),
  ('PHY301','01','Dr. Sadeghi',25,'Hall A','[{"day":0,"start":"12:00","end":"14:00"},{"day":2,"start":"12:00","end":"14:00"}]','2026-06-26','09:00','11:00'),
  ('MTH102','01','Dr. Tehrani',50,'Hall D','[{"day":1,"start":"12:00","end":"14:00"},{"day":3,"start":"12:00","end":"14:00"}]','2026-06-14','09:00','11:00'),
  ('PHY102','01','Dr. Rastgar',50,'Hall A','[{"day":0,"start":"18:00","end":"20:00"},{"day":2,"start":"18:00","end":"20:00"}]','2026-06-12','09:00','11:00')
) AS v(code, section_name, professor, capacity, location, meetings, exam_date, exam_start, exam_end)
JOIN public.courses c ON c.code = v.code AND c.owner_id IS NULL;