-- Participants no longer come from auth accounts; profiles become standalone participant records.
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_code_key ON public.profiles (code);
CREATE INDEX IF NOT EXISTS profiles_whatsapp_idx ON public.profiles (whatsapp);

ALTER TABLE public.assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_user_id_fkey;