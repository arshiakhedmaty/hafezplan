-- 1. imports
CREATE TABLE public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  raw_input text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'paste',
  status text NOT NULL DEFAULT 'ready',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imports TO authenticated;
GRANT ALL ON public.imports TO service_role;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own imports" ON public.imports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. courses / sections extensions
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES public.imports(id) ON DELETE CASCADE;
ALTER TABLE public.course_sections ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES public.imports(id) ON DELETE CASCADE;
ALTER TABLE public.course_sections ADD COLUMN IF NOT EXISTS group_number text;
ALTER TABLE public.course_sections ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'mixed';

-- 3. per-course selection preference
CREATE TABLE public.course_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  preference text NOT NULL DEFAULT 'neutral' CHECK (preference IN ('take','neutral','skip')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_preferences TO authenticated;
GRANT ALL ON public.course_preferences TO service_role;
ALTER TABLE public.course_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own course preferences" ON public.course_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. student gender on profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;

-- 5. remove the old seeded demo catalog
DELETE FROM public.course_sections;
DELETE FROM public.courses;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_course_preferences_updated_at BEFORE UPDATE ON public.course_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();