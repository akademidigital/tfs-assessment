DELETE FROM public.assessment_answers WHERE session_id IN (SELECT id FROM public.assessment_sessions WHERE user_id IN (SELECT id FROM public.profiles WHERE full_name = 'Uji Coba'));
DELETE FROM public.module_progress WHERE session_id IN (SELECT id FROM public.assessment_sessions WHERE user_id IN (SELECT id FROM public.profiles WHERE full_name = 'Uji Coba'));
DELETE FROM public.assessment_sessions WHERE user_id IN (SELECT id FROM public.profiles WHERE full_name = 'Uji Coba');
DELETE FROM public.profiles WHERE full_name = 'Uji Coba';