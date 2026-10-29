-- ==============================================================================
-- TARUNA FUTURE SCANNER (TFS) - FULL DATABASE INITIALIZATION SCRIPT
-- Jalankan skrip ini sekali di Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_direction') THEN
    CREATE TYPE public.item_direction AS ENUM ('F', 'UF');
  END IF;
END $$;

-- 2. CREATE TABLES

-- Profiles (Standalone participant records)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  age INTEGER,
  education_level TEXT,
  target_institution TEXT,
  target_program TEXT,
  city TEXT,
  guardian_contact TEXT,
  gender TEXT,
  class_level TEXT,
  school_name TEXT,
  major TEXT,
  whatsapp TEXT,
  birth_place TEXT,
  birth_date DATE,
  height_cm INTEGER,
  weight_kg INTEGER,
  guardian_name TEXT,
  guardian_whatsapp TEXT,
  career_target TEXT,
  referral_source TEXT,
  consent_version TEXT,
  consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_whatsapp_idx ON public.profiles(whatsapp);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

-- Content Versions
CREATE TABLE IF NOT EXISTS public.content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assessment Modules
CREATE TABLE IF NOT EXISTS public.assessment_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.content_versions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sequence INTEGER NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 8,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assessment_modules_version_id_code_key UNIQUE (version_id, code),
  CONSTRAINT assessment_modules_version_id_sequence_key UNIQUE (version_id, sequence)
);

-- Assessment Dimensions
CREATE TABLE IF NOT EXISTS public.assessment_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.assessment_modules(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sequence INTEGER NOT NULL,
  CONSTRAINT assessment_dimensions_module_id_code_key UNIQUE (module_id, code)
);
CREATE INDEX IF NOT EXISTS assessment_dimensions_module_id_idx ON public.assessment_dimensions(module_id);

-- Assessment Questions
CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.assessment_modules(id) ON DELETE CASCADE,
  dimension_id UUID NOT NULL REFERENCES public.assessment_dimensions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  text TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'F',
  sequence INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assessment_questions_module_id_code_key UNIQUE (module_id, code),
  CONSTRAINT assessment_questions_module_id_sequence_key UNIQUE (module_id, sequence)
);
CREATE INDEX IF NOT EXISTS assessment_questions_module_id_seq_idx ON public.assessment_questions(module_id, sequence);

-- Interpretation Bands
CREATE TABLE IF NOT EXISTS public.interpretation_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.assessment_modules(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'module',
  category TEXT NOT NULL,
  min_score NUMERIC(6,2) NOT NULL,
  max_score NUMERIC(6,2) NOT NULL,
  interpretation TEXT NOT NULL DEFAULT '',
  sequence INTEGER NOT NULL DEFAULT 1
);

-- Recommendations
CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.assessment_modules(id) ON DELETE CASCADE,
  category TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Support Contacts
CREATE TABLE IF NOT EXISTS public.support_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  phone TEXT,
  url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sequence INTEGER NOT NULL DEFAULT 1
);

-- Assessment Sessions
CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.content_versions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  scoring_calculated BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Module Progress
CREATE TABLE IF NOT EXISTS public.module_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.assessment_modules(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  answered_count INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT module_progress_session_id_module_id_key UNIQUE (session_id, module_id)
);
CREATE INDEX IF NOT EXISTS module_progress_session_idx ON public.module_progress(session_id);

-- Assessment Answers
CREATE TABLE IF NOT EXISTS public.assessment_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.assessment_modules(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  answer_value INTEGER NOT NULL,
  scored_value INTEGER NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assessment_answers_session_id_question_id_key UNIQUE (session_id, question_id)
);
CREATE INDEX IF NOT EXISTS assessment_answers_session_idx ON public.assessment_answers(session_id);

-- Dimension Results
CREATE TABLE IF NOT EXISTS public.dimension_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.assessment_modules(id) ON DELETE CASCADE,
  dimension_id UUID NOT NULL REFERENCES public.assessment_dimensions(id) ON DELETE CASCADE,
  raw_score NUMERIC(6,2) NOT NULL,
  normalized_score NUMERIC(6,2) NOT NULL,
  status TEXT NOT NULL
);

-- Assessment Results
CREATE TABLE IF NOT EXISTS public.assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.assessment_modules(id) ON DELETE CASCADE,
  raw_score NUMERIC(6,2) NOT NULL,
  normalized_score NUMERIC(6,2) NOT NULL,
  category TEXT NOT NULL,
  interpretation TEXT NOT NULL DEFAULT '',
  strongest_dimension_id UUID,
  weakest_dimension_id UUID
);

-- Overall Results
CREATE TABLE IF NOT EXISTS public.overall_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  readiness_score NUMERIC(6,2) NOT NULL,
  category TEXT NOT NULL,
  interpretation TEXT NOT NULL DEFAULT ''
);

-- Report Snapshots
CREATE TABLE IF NOT EXISTS public.report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. SEED DATA (BLUEPRINT V1.0)

-- Content Version
INSERT INTO public.content_versions (version, status, notes, published_at)
VALUES ('Blueprint v1.0', 'published', 'Diekstrak dari Blueprint Taruna Future Scanner v1.0', now())
ON CONFLICT (version) DO NOTHING;

-- Modules (9 Modul)
INSERT INTO public.assessment_modules (version_id, code, name, description, sequence, estimated_minutes, is_sensitive)
SELECT v.id, x.code, x.name, x.descr, x.seq, x.mins, x.sens
FROM public.content_versions v, (VALUES
  ('TMI', 'Taruna Mindset Index', 'Mengukur pola pikir dasar taruna: disiplin, integritas, tanggung jawab, kepatuhan, komitmen, dan mental pantang menyerah.', 1, 15, false),
  ('MTI', 'Mental Toughness Index', 'Mengukur ketangguhan mental menghadapi tekanan, kegagalan, dan kelelahan.', 2, 13, false),
  ('LPI', 'Leadership Potential Index', 'Mengukur potensi kepemimpinan, inisiatif, dan pengaruh positif.', 3, 12, false),
  ('DRI', 'Discipline Readiness Index', 'Mengukur kesiapan disiplin harian dan ketaatan pada aturan.', 4, 12, false),
  ('ARI', 'Academic Readiness Index', 'Mengukur kesiapan akademik dan kebiasaan belajar.', 5, 12, false),
  ('PPR', 'Physical Preparation Readiness', 'Mengukur kesiapan fisik dan kebiasaan latihan.', 6, 12, false),
  ('SPI', 'Stress & Pressure Index', 'Mengukur pengelolaan stres dan tekanan.', 7, 10, false),
  ('TCI', 'Taruna Commitment Index', 'Mengukur kekuatan komitmen terhadap jalur taruna.', 8, 12, false),
  ('MHS', 'Mental Health Screener', 'Skrining kesehatan mental. Bersifat skrining awal, bukan diagnosis.', 9, 12, true)
) AS x(code, name, descr, seq, mins, sens)
WHERE v.version = 'Blueprint v1.0'
ON CONFLICT (version_id, code) DO NOTHING;

-- Dimensions
INSERT INTO public.assessment_dimensions (module_id, code, name, sequence)
SELECT mo.id, x.dc, x.dn, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('TMI', 'DIS', 'Disiplin', 1),
  ('TMI', 'INT', 'Integritas', 2),
  ('TMI', 'TJW', 'Tanggung Jawab', 3),
  ('TMI', 'KAT', 'Kepatuhan', 4),
  ('TMI', 'KOM', 'Komitmen', 5),
  ('TMI', 'MPM', 'Mental Pantang Menyerah', 6),
  ('MTI', 'RES', 'Resilience', 1),
  ('MTI', 'EMC', 'Emotional Control', 2),
  ('MTI', 'STT', 'Stress Tolerance', 3),
  ('MTI', 'PER', 'Persistence', 4),
  ('MTI', 'ADP', 'Adaptability', 5),
  ('LPI', 'INI', 'Initiative', 1),
  ('LPI', 'DES', 'Decision Making', 2),
  ('LPI', 'INF', 'Influence', 3),
  ('LPI', 'ACC', 'Accountability', 4),
  ('LPI', 'TML', 'Team Leadership', 5),
  ('DRI', 'TMG', 'Time Management', 1),
  ('DRI', 'CON', 'Consistency', 2),
  ('DRI', 'PUN', 'Punctuality', 3),
  ('DRI', 'RCM', 'Rule Compliance', 4),
  ('DRI', 'POD', 'Personal Orderliness', 5),
  ('ARI', 'LPS', 'Learning Persistence', 1),
  ('ARI', 'CON', 'Concentration', 2),
  ('ARI', 'SST', 'Study Strategy', 3),
  ('ARI', 'AMO', 'Academic Motivation', 4),
  ('ARI', 'SLA', 'Self Learning', 5),
  ('PPR', 'EXH', 'Exercise Habit', 1),
  ('PPR', 'SLQ', 'Sleep Quality', 2),
  ('PPR', 'NUT', 'Nutrition Awareness', 3),
  ('PPR', 'PHC', 'Physical Consistency', 4),
  ('PPR', 'HLR', 'Health Responsibility', 5),
  ('SPI', 'EXA', 'Exam Anxiety', 1),
  ('SPI', 'FOF', 'Fear of Failure', 2),
  ('SPI', 'OVT', 'Overthinking', 3),
  ('SPI', 'FPR', 'Family Pressure', 4),
  ('SPI', 'EST', 'Emotional Stress', 5),
  ('TCI', 'MTC', 'Motivation Clarity', 1),
  ('TCI', 'CAW', 'Career Awareness', 2),
  ('TCI', 'LTC', 'Long-Term Commitment', 3),
  ('TCI', 'VAL', 'Value Alignment', 4),
  ('TCI', 'SVO', 'Service Orientation', 5),
  ('MHS', 'EWB', 'Emotional Wellbeing', 1),
  ('MHS', 'SEE', 'Self Esteem', 2),
  ('MHS', 'ANX', 'Anxiety Indicator', 3),
  ('MHS', 'RSL', 'Resilience', 4),
  ('MHS', 'SSP', 'Social Support', 5)
) AS x(mc, dc, dn, sq) ON x.mc = mo.code
ON CONFLICT (module_id, code) DO NOTHING;

-- Interpretation Bands (Module & Overall)
INSERT INTO public.interpretation_bands (module_id, scope, category, min_score, max_score, interpretation, sequence)
SELECT mo.id, 'module', x.cat, x.mn, x.mx, x.interp, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('TMI', 'Rendah', 43, 107, 'Pola pikir taruna belum terbentuk. Peserta perlu pembinaan karakter intensif sebelum mengikuti seleksi. Disiplin, integritas, dan komitmen masih sangat lemah.', 1),
  ('TMI', 'Sedang', 108, 171, 'Beberapa nilai taruna sudah mulai terbentuk namun belum konsisten. Perlu penguatan pada dimensi yang masih lemah melalui program pembinaan terstruktur.', 2),
  ('TMI', 'Tinggi', 172, 215, 'Pola pikir taruna sudah kuat. Peserta memiliki karakter dasar yang baik untuk menjalani pendidikan militer/kepolisian/kedinasan.', 3),
  ('MTI', 'Rendah', 38, 94, 'Ketangguhan mental masih sangat lemah. Peserta berpotensi tinggi mengalami burnout atau dropout di awal pendidikan taruna. Perlu program resilience building yang intensif.', 1),
  ('MTI', 'Sedang', 95, 152, 'Ketangguhan mental cukup namun belum optimal. Mampu bertahan dalam tekanan ringan-sedang, namun perlu penguatan pada dimensi tertentu yang masih lemah.', 2),
  ('MTI', 'Tinggi', 153, 190, 'Ketangguhan mental sangat baik. Peserta siap menghadapi tekanan fisik-psikologis tinggi dalam pendidikan taruna.', 3),
  ('LPI', 'Rendah', 37, 92, 'Potensi kepemimpinan masih sangat terbatas. Peserta perlu pengembangan karakter kepemimpinan, mulai dari keberanian mengambil inisiatif hingga kemampuan mengelola tim.', 1),
  ('LPI', 'Sedang', 93, 148, 'Potensi kepemimpinan cukup, namun belum terukur dalam situasi tekanan tinggi. Perlu pengalaman nyata memimpin dan melatih keterampilan pengambilan keputusan.', 2),
  ('LPI', 'Tinggi', 149, 185, 'Potensi kepemimpinan sangat kuat. Peserta memiliki karakter pemimpin yang alami dan siap dikembangkan menjadi pemimpin di lingkungan taruna.', 3),
  ('DRI', 'Rendah', 37, 92, 'Kesiapan disiplin sangat kurang. Peserta akan mengalami kesulitan besar menyesuaikan diri dengan sistem disiplin ketat di lingkungan taruna. Perlu perubahan kebiasaan fundamental.', 1),
  ('DRI', 'Sedang', 93, 148, 'Kesiapan disiplin cukup memadai namun masih ada area yang perlu diperkuat. Beberapa kebiasaan disiplin sudah terbentuk, namun belum konsisten di semua dimensi.', 2),
  ('DRI', 'Tinggi', 149, 185, 'Kesiapan disiplin sangat baik. Peserta sudah memiliki kebiasaan dan perilaku yang selaras dengan tuntutan disiplin lingkungan taruna.', 3),
  ('ARI', 'Rendah', 37, 92, 'Kesiapan akademik masih sangat kurang. Peserta perlu membangun kebiasaan belajar dari awal, memperkuat motivasi akademik, dan mengembangkan strategi belajar yang efektif.', 1),
  ('ARI', 'Sedang', 93, 148, 'Kesiapan akademik cukup, namun perlu peningkatan pada dimensi yang masih lemah. Beberapa kebiasaan belajar sudah terbentuk, namun belum cukup kuat untuk kompetisi ketat seleksi taruna.', 2),
  ('ARI', 'Tinggi', 149, 185, 'Kesiapan akademik sangat baik. Peserta memiliki fondasi belajar yang kuat dan siap bersaing secara akademik dalam seleksi taruna.', 3),
  ('PPR', 'Rendah', 37, 92, 'Kesiapan fisik masih sangat kurang. Peserta perlu membangun fondasi kebiasaan olahraga, pola tidur, dan nutrisi yang sehat. Risiko tinggi gagal tes fisik dan kesehatan seleksi.', 1),
  ('PPR', 'Sedang', 93, 148, 'Kesiapan fisik cukup namun perlu peningkatan pada area tertentu. Beberapa kebiasaan sehat sudah ada, namun belum cukup optimal untuk menghadapi seleksi fisik yang ketat.', 2),
  ('PPR', 'Tinggi', 149, 185, 'Kesiapan fisik sangat baik. Peserta memiliki gaya hidup sehat yang konsisten dan siap menghadapi tuntutan fisik seleksi dan pendidikan taruna.', 3),
  ('SPI', 'Perlu Perhatian', 31, 77, 'Tingkat stres dan tekanan sangat tinggi. Peserta menunjukkan indikator kecemasan, ketakutan gagal, overthinking, dan/atau tekanan keluarga yang signifikan. Perlu pendampingan psikologis segera.', 1),
  ('SPI', 'Moderat', 78, 124, 'Tingkat stres sedang. Ada beberapa sumber tekanan yang perlu dikelola. Disarankan strategi coping yang lebih baik dan dukungan dari lingkungan terdekat.', 2),
  ('SPI', 'Terkendali', 125, 155, 'Tingkat stres terkendali dengan baik. Peserta mampu mengelola berbagai tekanan dengan efektif dan memiliki resiliensi yang baik terhadap situasi sulit.', 3),
  ('TCI', 'Rendah', 37, 92, 'Komitmen terhadap jalur taruna masih lemah dan belum terbentuk secara mendalam. Motivasi belum jelas, kesadaran karier kurang, dan nilai belum selaras. Perlu refleksi mendalam sebelum melanjutkan persiapan.', 1),
  ('TCI', 'Sedang', 93, 148, 'Komitmen cukup namun masih ada area yang perlu diperkuat, terutama kesadaran karier, kejelasan motivasi, atau orientasi pengabdian. Perlu pendalaman lebih lanjut tentang makna dan tujuan pilihan karier ini.', 2),
  ('TCI', 'Tinggi', 149, 185, 'Komitmen taruna sangat kuat. Peserta memiliki motivasi yang jelas, pemahaman karier yang baik, nilai yang selaras, dan orientasi pengabdian yang tulus. Fondasi mental yang sangat kuat.', 3),
  ('MHS', 'Perlu Rujukan', 37, 92, 'Indikator menunjukkan kemungkinan adanya distres psikologis yang signifikan. SANGAT DISARANKAN untuk berkonsultasi dengan psikolog atau konselor profesional. Ini BUKAN diagnosis.', 1),
  ('MHS', 'Perlu Perhatian', 93, 148, 'Terdapat beberapa area kesehatan mental yang memerlukan perhatian dan pemantauan. Disarankan membangun dukungan sosial yang lebih kuat dan menerapkan strategi self-care yang lebih baik.', 2),
  ('MHS', 'Baik', 149, 185, 'Kondisi kesehatan mental secara umum dalam keadaan baik. Pertahankan dan perkuat faktor protektif seperti dukungan sosial, manajemen stres, dan kebiasaan hidup sehat.', 3)
) AS x(mc, cat, mn, mx, interp, sq) ON x.mc = mo.code;

INSERT INTO public.interpretation_bands (module_id, scope, category, min_score, max_score, interpretation, sequence)
VALUES
  (null, 'overall', 'Perlu Penguatan', 0, 40, 'Kesiapan menyeluruh masih perlu penguatan pada banyak area.', 1),
  (null, 'overall', 'Berkembang', 40.01, 70, 'Kesiapan menyeluruh sedang berkembang.', 2),
  (null, 'overall', 'Siap', 70.01, 100, 'Kesiapan menyeluruh tergolong baik.', 3);

-- Support Contacts
INSERT INTO public.support_contacts (label, description, sequence)
VALUES
  ('Layanan Konseling Akademi Taruna', 'Layanan pendampingan psikologis resmi untuk persiapan taruna.', 1),
  ('Pusat Bimbingan Psikologi', 'Kontak psikolog rujukan untuk konsultasi lanjutan.', 2);

-- 4. ASSESSMENT QUESTIONS

-- Questions: TMI (Taruna Mindset Index)
INSERT INTO public.assessment_questions (module_id, dimension_id, code, text, direction, sequence)
SELECT mo.id, di.id, x.qc, x.qt, x.dir, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('TMI-DIS-01','Saya selalu bangun pagi sesuai waktu yang saya tetapkan, meskipun tidak ada yang membangunkan saya.','F',1,'DIS'),
  ('TMI-DIS-02','Saya menyelesaikan pekerjaan rumah atau tugas sekolah sebelum bermain atau menonton hiburan.','F',2,'DIS'),
  ('TMI-DIS-03','Ketika saya menetapkan jadwal belajar, saya mengikutinya dengan konsisten.','F',3,'DIS'),
  ('TMI-DIS-04','Saya mampu menolak ajakan bermain ketika saya tahu ada kewajiban yang belum selesai.','F',4,'DIS'),
  ('TMI-DIS-05','Saya merapikan kamar atau tempat belajar secara rutin tanpa harus disuruh.','F',5,'DIS'),
  ('TMI-DIS-06','Saya sering menunda-nunda pekerjaan sampai mendekati batas waktu.','UF',6,'DIS'),
  ('TMI-DIS-07','Saya sulit bangun pagi jika tidak ada yang memaksa saya.','UF',7,'DIS'),
  ('TMI-DIS-08','Saya kerap lupa dengan jadwal atau komitmen yang sudah saya buat sendiri.','UF',8,'DIS'),
  ('TMI-DIS-09','Ketika tidak ada yang mengawasi, saya cenderung tidak mengikuti aturan yang sudah ditetapkan.','UF',9,'DIS'),
  ('TMI-INT-01','Saya jujur mengakui kesalahan saya meskipun itu bisa membuat saya kena masalah.','F',10,'INT'),
  ('TMI-INT-02','Saya tidak mencontek dalam ujian meskipun teman-teman di sekitar saya melakukannya.','F',11,'INT'),
  ('TMI-INT-03','Saya berperilaku sama baik ketika ada guru/orang tua maupun ketika sendirian.','F',12,'INT'),
  ('TMI-INT-04','Saya segera melaporkan jika saya menemukan barang milik orang lain.','F',13,'INT'),
  ('TMI-INT-05','Saya menepati janji meskipun melanggarnya lebih mudah dan tidak ada yang tahu.','F',14,'INT'),
  ('TMI-INT-06','Saya kadang berbohong untuk menghindari masalah atau hukuman.','UF',15,'INT'),
  ('TMI-INT-07','Saya pernah mencari cara curang agar mendapat nilai atau hasil yang lebih baik.','UF',16,'INT'),
  ('TMI-INT-08','Saya berperilaku berbeda tergantung siapa yang melihat saya.','UF',17,'INT'),
  ('TMI-TJW-01','Jika saya membuat kesalahan, saya bertanggung jawab dan tidak mencari kambing hitam.','F',18,'TJW'),
  ('TMI-TJW-02','Saya memastikan semua tugas yang diberikan kepada saya selesai dengan baik.','F',19,'TJW'),
  ('TMI-TJW-03','Ketika saya terlibat dalam kelompok, saya memastikan bagian saya selesai tepat waktu.','F',20,'TJW'),
  ('TMI-TJW-04','Saya proaktif mencari solusi ketika menghadapi masalah daripada menunggu orang lain.','F',21,'TJW'),
  ('TMI-TJW-05','Saya bersedia menanggung konsekuensi dari setiap keputusan yang saya ambil.','F',22,'TJW'),
  ('TMI-TJW-06','Ketika ada yang salah, saya cenderung menyalahkan keadaan atau orang lain.','UF',23,'TJW'),
  ('TMI-TJW-07','Saya sering meninggalkan pekerjaan belum selesai dan beralih ke hal lain.','UF',24,'TJW'),
  ('TMI-KAT-01','Saya mengikuti peraturan sekolah meskipun saya tidak setuju dengan aturan tersebut.','F',25,'KAT'),
  ('TMI-KAT-02','Saya menghormati keputusan atasan atau guru meskipun berbeda dengan pendapat saya.','F',26,'KAT'),
  ('TMI-KAT-03','Saya menggunakan seragam atau atribut sesuai ketentuan tanpa harus diingatkan.','F',27,'KAT'),
  ('TMI-KAT-04','Dalam situasi apapun, saya berusaha mengikuti prosedur yang telah ditetapkan.','F',28,'KAT'),
  ('TMI-KAT-05','Saya merasa terlalu banyak aturan yang tidak masuk akal dan sering saya abaikan.','UF',29,'KAT'),
  ('TMI-KAT-06','Saya lebih suka melakukan hal dengan cara saya sendiri daripada mengikuti prosedur baku.','UF',30,'KAT'),
  ('TMI-KOM-01','Meskipun perjalanan menuju cita-cita saya sangat panjang, saya tidak akan berhenti di tengah jalan.','F',31,'KOM'),
  ('TMI-KOM-02','Saya rela mengorbankan waktu hiburan demi mengejar tujuan jangka panjang saya.','F',32,'KOM'),
  ('TMI-KOM-03','Saya tetap pada rencana saya meski banyak godaan atau hambatan yang muncul.','F',33,'KOM'),
  ('TMI-KOM-04','Ketika bergabung dalam sebuah organisasi atau kelompok, saya berkomitmen penuh.','F',34,'KOM'),
  ('TMI-KOM-05','Saya mudah ganti-ganti tujuan atau rencana ketika ada sesuatu yang lebih menarik.','UF',35,'KOM'),
  ('TMI-KOM-06','Saya sering berhenti di tengah jalan ketika sesuatu menjadi terlalu sulit.','UF',36,'KOM'),
  ('TMI-MPM-01','Ketika gagal dalam ujian atau seleksi, saya langsung menyusun rencana untuk mencoba lagi.','F',37,'MPM'),
  ('TMI-MPM-02','Saya melihat kegagalan sebagai pelajaran berharga bukan sebagai akhir segalanya.','F',38,'MPM'),
  ('TMI-MPM-03','Saat fisik dan mental saya lelah, saya masih mampu mendorong diri untuk terus bergerak.','F',39,'MPM'),
  ('TMI-MPM-04','Saya tidak mudah menyerah hanya karena mendapat komentar negatif dari orang lain.','F',40,'MPM'),
  ('TMI-MPM-05','Saya percaya setiap kesulitan pasti ada jalan keluarnya jika saya mau terus berusaha.','F',41,'MPM'),
  ('TMI-MPM-06','Ketika saya gagal beberapa kali, saya mulai mempertimbangkan untuk menyerah.','UF',42,'MPM'),
  ('TMI-MPM-07','Saya mudah putus asa ketika menghadapi rintangan yang terasa berat.','UF',43,'MPM')
) AS x(qc,qt,dir,sq,dc) ON true
JOIN public.assessment_dimensions di ON di.module_id = mo.id AND di.code = x.dc
WHERE mo.code = 'TMI'
ON CONFLICT (module_id, code) DO NOTHING;

-- Questions: MTI (Mental Toughness Index)
INSERT INTO public.assessment_questions (module_id, dimension_id, code, text, direction, sequence)
SELECT mo.id, di.id, x.qc, x.qt, x.dir, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('MTI-RES-01','Setelah mengalami kegagalan besar, saya bisa bangkit kembali dalam waktu yang tidak terlalu lama.','F',1,'RES'),
  ('MTI-RES-02','Ketika situasi terasa sangat berat, saya mencari cara untuk tetap maju daripada menyerah.','F',2,'RES'),
  ('MTI-RES-03','Saya mampu melihat sisi positif dari pengalaman buruk yang saya alami.','F',3,'RES'),
  ('MTI-RES-04','Saya tidak membiarkan satu kegagalan menentukan seluruh masa depan saya.','F',4,'RES'),
  ('MTI-RES-05','Saat mengalami kesulitan, saya segera fokus mencari solusi daripada meratapi masalah.','F',5,'RES'),
  ('MTI-RES-06','Ketika sesuatu yang buruk terjadi, saya butuh waktu sangat lama untuk bisa kembali normal.','UF',6,'RES'),
  ('MTI-RES-07','Setelah mengalami kegagalan, saya sering merasa tidak yakin bisa mencoba lagi.','UF',7,'RES'),
  ('MTI-RES-08','Saya sering terjebak dalam pikiran negatif yang sulit saya hentikan sendiri.','UF',8,'RES'),
  ('MTI-EMC-01','Saya bisa tetap tenang dan berpikir jernih meskipun situasi di sekitar saya penuh tekanan.','F',9,'EMC'),
  ('MTI-EMC-02','Ketika ada yang mengkritik saya, saya mendengarkan dengan kepala dingin tanpa langsung marah.','F',10,'EMC'),
  ('MTI-EMC-03','Saya mampu mengendalikan reaksi emosi saya meskipun saya sangat marah atau kecewa.','F',11,'EMC'),
  ('MTI-EMC-04','Saat menghadapi situasi yang memancing emosi, saya mengambil jeda sebelum bereaksi.','F',12,'EMC'),
  ('MTI-EMC-05','Saya tidak membiarkan perasaan sedih atau marah mengganggu kinerja dan tugas saya.','F',13,'EMC'),
  ('MTI-EMC-06','Saya mudah tersulut emosi ketika menghadapi tekanan atau kritikan dari orang lain.','UF',14,'EMC'),
  ('MTI-EMC-07','Ketika marah, saya sering bertindak tanpa berpikir panjang terlebih dahulu.','UF',15,'EMC'),
  ('MTI-EMC-08','Saya sulit menyembunyikan perasaan negatif saya meskipun situasinya mengharuskan saya tenang.','UF',16,'EMC'),
  ('MTI-STT-01','Saat banyak tugas menumpuk sekaligus, saya masih bisa menyusun prioritas dengan baik.','F',17,'STT'),
  ('MTI-STT-02','Saya tetap dapat bekerja efektif meskipun sedang berada di bawah tekanan waktu yang ketat.','F',18,'STT'),
  ('MTI-STT-03','Dalam situasi kacau atau tidak menentu, saya masih bisa berpikir dengan jernih.','F',19,'STT'),
  ('MTI-STT-04','Saya bisa menerima ketidakpastian tanpa merasa sangat cemas atau tidak nyaman.','F',20,'STT'),
  ('MTI-STT-05','Ketika menghadapi ujian atau situasi penting, kualitas kinerja saya tidak turun drastis.','F',21,'STT'),
  ('MTI-STT-06','Ketika banyak hal terjadi sekaligus, saya merasa kewalahan dan tidak tahu harus mulai dari mana.','UF',22,'STT'),
  ('MTI-STT-07','Tekanan dari luar membuat saya sulit berkonsentrasi dan membuat keputusan.','UF',23,'STT'),
  ('MTI-PER-01','Saya tetap berlatih atau belajar secara rutin meskipun hasilnya belum terlihat dalam waktu lama.','F',24,'PER'),
  ('MTI-PER-02','Saya bisa menyelesaikan tugas yang membosankan hingga tuntas tanpa banyak mengeluh.','F',25,'PER'),
  ('MTI-PER-03','Meskipun sudah sangat lelah, saya berusaha mempertahankan standar kualitas kerja saya.','F',26,'PER'),
  ('MTI-PER-04','Saya konsisten menjalankan program latihan fisik saya meskipun cuaca buruk atau kondisi tidak ideal.','F',27,'PER'),
  ('MTI-PER-05','Saya tidak berhenti hanya karena usaha saya belum membuahkan hasil yang saya harapkan.','F',28,'PER'),
  ('MTI-PER-06','Saya mudah berhenti atau menyerah ketika sesuatu mulai terasa sangat melelahkan.','UF',29,'PER'),
  ('MTI-PER-07','Ketika tidak melihat kemajuan yang jelas, saya kehilangan motivasi untuk melanjutkan.','UF',30,'PER'),
  ('MTI-ADP-01','Saya bisa dengan cepat menyesuaikan diri ketika lingkungan atau aturan di sekitar saya berubah.','F',31,'ADP'),
  ('MTI-ADP-02','Saya terbuka terhadap cara-cara baru yang berbeda dari kebiasaan saya selama ini.','F',32,'ADP'),
  ('MTI-ADP-03','Ketika rencana saya gagal, saya dengan cepat menyusun rencana cadangan.','F',33,'ADP'),
  ('MTI-ADP-04','Saya bisa bekerja dengan baik dalam berbagai kondisi dan lingkungan yang berbeda-beda.','F',34,'ADP'),
  ('MTI-ADP-05','Perubahan mendadak tidak membuat saya panik; saya berusaha menyesuaikan diri.','F',35,'ADP'),
  ('MTI-ADP-06','Saya sangat tidak nyaman ketika rutinitas atau rencana saya berubah secara tiba-tiba.','UF',36,'ADP'),
  ('MTI-ADP-07','Saya sulit beradaptasi ketika harus mengikuti cara atau sistem yang baru bagi saya.','UF',37,'ADP'),
  ('MTI-ADP-08','Perubahan aturan yang mendadak membuat saya stres dan sulit berkonsentrasi.','UF',38,'ADP')
) AS x(qc,qt,dir,sq,dc) ON true
JOIN public.assessment_dimensions di ON di.module_id = mo.id AND di.code = x.dc
WHERE mo.code = 'MTI'
ON CONFLICT (module_id, code) DO NOTHING;

-- Questions: LPI (Leadership Potential Index)
INSERT INTO public.assessment_questions (module_id, dimension_id, code, text, direction, sequence)
SELECT mo.id, di.id, x.qc, x.qt, x.dir, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('LPI-INI-01','Ketika melihat ada masalah dalam kelompok, saya langsung mengambil tindakan tanpa menunggu orang lain.','F',1,'INI'),
  ('LPI-INI-02','Saya sering menjadi orang pertama yang mengusulkan ide atau rencana baru dalam kelompok.','F',2,'INI'),
  ('LPI-INI-03','Saya tidak ragu memulai suatu kegiatan meskipun belum ada yang memimpin atau memerintah.','F',3,'INI'),
  ('LPI-INI-04','Ketika ada tugas kelompok, saya proaktif membagi pekerjaan agar semua bagian tertangani.','F',4,'INI'),
  ('LPI-INI-05','Saya berani maju menjadi ketua atau koordinator meskipun tidak diwajibkan.','F',5,'INI'),
  ('LPI-INI-06','Saya lebih suka menunggu orang lain mengambil tindakan sebelum saya ikut bergerak.','UF',6,'INI'),
  ('LPI-INI-07','Saya jarang menawarkan diri untuk memimpin atau mengkoordinasi kegiatan kelompok.','UF',7,'INI'),
  ('LPI-DES-01','Ketika kelompok tidak bisa mengambil keputusan, saya berani mengambil alih dan memutuskan.','F',8,'DES'),
  ('LPI-DES-02','Saya mampu membuat keputusan yang sulit meskipun hasilnya belum pasti.','F',9,'DES'),
  ('LPI-DES-03','Sebelum memutuskan sesuatu, saya mempertimbangkan berbagai sudut pandang dan kemungkinan risiko.','F',10,'DES'),
  ('LPI-DES-04','Saya tetap bisa membuat keputusan yang rasional meskipun sedang dalam tekanan.','F',11,'DES'),
  ('LPI-DES-05','Saya bertanggung jawab penuh atas setiap keputusan yang saya ambil dalam kelompok.','F',12,'DES'),
  ('LPI-DES-06','Saya merasa tidak nyaman ketika harus mengambil keputusan penting sendirian.','UF',13,'DES'),
  ('LPI-DES-07','Saya sering menunda-nunda keputusan karena takut membuat pilihan yang salah.','UF',14,'DES'),
  ('LPI-INF-01','Teman-teman saya sering mengikuti saran atau ide yang saya usulkan.','F',15,'INF'),
  ('LPI-INF-02','Saya bisa membuat orang lain bersemangat untuk menyelesaikan tugas yang sulit.','F',16,'INF'),
  ('LPI-INF-03','Saya memengaruhi orang lain lebih banyak melalui contoh tindakan saya, bukan hanya kata-kata.','F',17,'INF'),
  ('LPI-INF-04','Ketika ada anggota kelompok yang kurang semangat, saya berusaha membangkitkan motivasinya.','F',18,'INF'),
  ('LPI-INF-05','Saya mampu meyakinkan orang lain terhadap sudut pandang atau rencana yang saya percaya benar.','F',19,'INF'),
  ('LPI-INF-06','Saya sulit membuat orang lain mengikuti atau mempercayai ide-ide yang saya miliki.','UF',20,'INF'),
  ('LPI-INF-07','Saya merasa kurang mampu memotivasi orang lain ketika mereka sedang tidak bersemangat.','UF',21,'INF'),
  ('LPI-ACC-01','Ketika tim saya gagal, saya ikut bertanggung jawab meskipun kegagalan bukan sepenuhnya salah saya.','F',22,'ACC'),
  ('LPI-ACC-02','Saya transparan dan jujur kepada anggota tim saya, termasuk tentang kesalahan yang saya buat.','F',23,'ACC'),
  ('LPI-ACC-03','Saya memberikan apresiasi kepada anggota tim yang bekerja dengan baik secara terbuka.','F',24,'ACC'),
  ('LPI-ACC-04','Saya tidak mencari alasan atau melemparkan kesalahan kepada orang lain ketika ada yang tidak berjalan.','F',25,'ACC'),
  ('LPI-ACC-05','Ketika tim saya gagal, saya cenderung menunjuk faktor lain atau orang lain sebagai penyebabnya.','UF',26,'ACC'),
  ('LPI-ACC-06','Saya kadang menyembunyikan kesalahan saya agar tidak dinilai buruk oleh anggota tim.','UF',27,'ACC'),
  ('LPI-TML-01','Saya bisa membagi tugas secara adil dan sesuai kemampuan masing-masing anggota tim.','F',28,'TML'),
  ('LPI-TML-02','Ketika ada konflik dalam tim, saya berusaha menjadi penengah dan mencari solusi yang adil.','F',29,'TML'),
  ('LPI-TML-03','Saya memastikan setiap anggota tim merasa didengar dan berkontribusi dalam pengambilan keputusan.','F',30,'TML'),
  ('LPI-TML-04','Saya membangun suasana kerja tim yang positif, saling mendukung, dan saling percaya.','F',31,'TML'),
  ('LPI-TML-05','Saya bisa mengkoordinasikan berbagai tugas dalam tim agar selesai tepat waktu dan berkualitas.','F',32,'TML'),
  ('LPI-TML-06','Saya kesulitan mengelola anggota tim yang punya kepribadian atau cara kerja yang berbeda-beda.','UF',33,'TML'),
  ('LPI-TML-07','Saya kurang nyaman ketika harus menghadapi dan menyelesaikan konflik di dalam tim saya.','UF',34,'TML')
) AS x(qc,qt,dir,sq,dc) ON true
JOIN public.assessment_dimensions di ON di.module_id = mo.id AND di.code = x.dc
WHERE mo.code = 'LPI'
ON CONFLICT (module_id, code) DO NOTHING;

-- Questions: DRI (Discipline Readiness Index)
INSERT INTO public.assessment_questions (module_id, dimension_id, code, text, direction, sequence)
SELECT mo.id, di.id, x.qc, x.qt, x.dir, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('DRI-TMG-01','Saya selalu menyelesaikan tugas atau PR sebelum batas waktu yang ditentukan.','F',1,'TMG'),
  ('DRI-TMG-02','Saya membuat jadwal harian dan berusaha mengikutinya dengan konsisten.','F',2,'TMG'),
  ('DRI-TMG-03','Saya bisa memperkirakan berapa lama waktu yang dibutuhkan untuk menyelesaikan suatu tugas.','F',3,'TMG'),
  ('DRI-TMG-04','Saya mendahulukan tugas yang penting dan mendesak sebelum yang lain.','F',4,'TMG'),
  ('DRI-TMG-05','Saya tidak membiarkan waktu habis untuk kegiatan yang tidak produktif ketika ada kewajiban yang menunggu.','F',5,'TMG'),
  ('DRI-TMG-06','Saya sering mengerjakan tugas di menit-menit terakhir karena menunda-nunda.','UF',6,'TMG'),
  ('DRI-TMG-07','Saya kesulitan memperkirakan waktu, sehingga sering kehabisan waktu sebelum pekerjaan selesai.','UF',7,'TMG'),
  ('DRI-CON-01','Saya menjalani rutinitas yang sama setiap hari tanpa banyak perubahan yang tidak perlu.','F',8,'CON'),
  ('DRI-CON-02','Kualitas kerja atau hasil latihan saya cenderung stabil dari waktu ke waktu.','F',9,'CON'),
  ('DRI-CON-03','Saya bisa mempertahankan semangat dan usaha yang sama meskipun sudah berjalan berminggu-minggu.','F',10,'CON'),
  ('DRI-CON-04','Saya menjalani program latihan fisik atau belajar saya secara teratur tanpa banyak melewatkan sesi.','F',11,'CON'),
  ('DRI-CON-05','Perilaku dan sikap saya konsisten baik ketika ada orang maupun ketika sendirian.','F',12,'CON'),
  ('DRI-CON-06','Semangat dan motivasi saya naik turun dengan sangat drastis dari hari ke hari.','UF',13,'CON'),
  ('DRI-CON-07','Saya sering melewatkan sesi latihan atau belajar karena merasa malas atau tidak mood.','UF',14,'CON'),
  ('DRI-PUN-01','Saya selalu hadir di tempat kegiatan sebelum waktu yang ditentukan.','F',15,'PUN'),
  ('DRI-PUN-02','Saya menyiapkan semua keperluan dari malam sebelumnya agar tidak terlambat keesokan harinya.','F',16,'PUN'),
  ('DRI-PUN-03','Saya menghargai waktu orang lain dan tidak membuat mereka menunggu.','F',17,'PUN'),
  ('DRI-PUN-04','Ketika ada janji atau jadwal, saya selalu tiba tepat waktu bahkan lebih awal.','F',18,'PUN'),
  ('DRI-PUN-05','Saya sudah siap dan rapi sebelum waktu keberangkatan, bukan tergesa-gesa di menit terakhir.','F',19,'PUN'),
  ('DRI-PUN-06','Saya sering terlambat ke sekolah, tempat latihan, atau pertemuan penting.','UF',20,'PUN'),
  ('DRI-PUN-07','Saya biasanya bergegas di menit terakhir sehingga sering tampak tidak siap.','UF',21,'PUN'),
  ('DRI-RCM-01','Saya mematuhi peraturan sekolah atau organisasi secara penuh tanpa mencari-cari pengecualian.','F',22,'RCM'),
  ('DRI-RCM-02','Saya mengikuti prosedur dan tata cara yang sudah ditentukan meskipun ada cara yang lebih mudah.','F',23,'RCM'),
  ('DRI-RCM-03','Saya memakai seragam dan atribut sesuai ketentuan setiap saat.','F',24,'RCM'),
  ('DRI-RCM-04','Saya tidak mencari celah atau pembenaran untuk melanggar aturan meskipun bisa lolos.','F',25,'RCM'),
  ('DRI-RCM-05','Saya sering melanggar aturan kecil-kecil yang menurut saya tidak begitu penting.','UF',26,'RCM'),
  ('DRI-RCM-06','Saya merasa beberapa aturan yang ada tidak perlu diikuti karena tidak masuk akal.','UF',27,'RCM'),
  ('DRI-POD-01','Kamar atau tempat tinggal saya selalu dalam keadaan rapi dan bersih.','F',28,'POD'),
  ('DRI-POD-02','Barang-barang saya selalu tersimpan di tempat yang tepat sehingga mudah ditemukan.','F',29,'POD'),
  ('DRI-POD-03','Penampilan saya (seragam, rambut, sepatu) selalu rapi sesuai standar yang berlaku.','F',30,'POD'),
  ('DRI-POD-04','Saya menjaga kebersihan dan kerapian diri sebagai bagian dari rutinitas harian saya.','F',31,'POD'),
  ('DRI-POD-05','Saya tidak membiarkan lingkungan sekitar saya berantakan meskipun tidak ada yang menegur.','F',32,'POD'),
  ('DRI-POD-06','Kamar dan barang-barang saya sering dalam keadaan tidak tertata dan sulit dicari.','UF',33,'POD'),
  ('DRI-POD-07','Saya jarang memperhatikan kerapian penampilan kecuali jika ada acara formal.','UF',34,'POD')
) AS x(qc,qt,dir,sq,dc) ON true
JOIN public.assessment_dimensions di ON di.module_id = mo.id AND di.code = x.dc
WHERE mo.code = 'DRI'
ON CONFLICT (module_id, code) DO NOTHING;

-- Questions: ARI (Academic Readiness Index)
INSERT INTO public.assessment_questions (module_id, dimension_id, code, text, direction, sequence)
SELECT mo.id, di.id, x.qc, x.qt, x.dir, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('ARI-LPS-01','Ketika menghadapi soal atau materi yang sulit, saya terus berusaha sampai benar-benar paham.','F',1,'LPS'),
  ('ARI-LPS-02','Saya tidak menyerah mempelajari mata pelajaran yang menurut saya sulit atau membosankan.','F',2,'LPS'),
  ('ARI-LPS-03','Saya rela mengulang materi berkali-kali sampai benar-benar menguasainya.','F',3,'LPS'),
  ('ARI-LPS-04','Saya mengerjakan latihan soal ekstra secara mandiri untuk memastikan pemahaman saya cukup.','F',4,'LPS'),
  ('ARI-LPS-05','Ketika belajar untuk ujian penting, saya tidak berhenti meskipun sudah berjam-jam.','F',5,'LPS'),
  ('ARI-LPS-06','Ketika materi terlalu sulit, saya cenderung melewati dan berharap tidak keluar di ujian.','UF',6,'LPS'),
  ('ARI-LPS-07','Saya mudah bosan belajar dan berhenti sebelum benar-benar paham.','UF',7,'LPS'),
  ('ARI-CON-01','Saya bisa belajar dengan fokus penuh selama minimal dua jam tanpa banyak terganggu.','F',8,'CON'),
  ('ARI-CON-02','Ketika belajar, saya mematikan atau menjauhkan HP agar tidak mengganggu fokus saya.','F',9,'CON'),
  ('ARI-CON-03','Saya mampu kembali fokus dengan cepat setelah sempat teralihkan perhatiannya.','F',10,'CON'),
  ('ARI-CON-04','Saya memilih tempat belajar yang kondusif dan menghindari gangguan sebisa mungkin.','F',11,'CON'),
  ('ARI-CON-05','Saya bisa menyerap materi pelajaran secara mendalam bukan hanya membaca sepintas.','F',12,'CON'),
  ('ARI-CON-06','Saya sangat mudah terdistraksi oleh media sosial atau suara-suara di sekitar saat belajar.','UF',13,'CON'),
  ('ARI-CON-07','Saya sering melamun saat belajar sehingga tidak menyerap materi dengan baik.','UF',14,'CON'),
  ('ARI-SST-01','Saya menggunakan berbagai metode belajar seperti peta konsep, ringkasan, atau latihan soal.','F',15,'SST'),
  ('ARI-SST-02','Saya merencanakan jadwal belajar yang terstruktur untuk setiap mata pelajaran.','F',16,'SST'),
  ('ARI-SST-03','Saya secara berkala mengulang materi yang sudah dipelajari sebelum ujian.','F',17,'SST'),
  ('ARI-SST-04','Saya membuat catatan belajar yang terorganisir dan mudah dipahami kembali.','F',18,'SST'),
  ('ARI-SST-05','Saya mengevaluasi sendiri seberapa jauh pemahaman saya setelah belajar suatu topik.','F',19,'SST'),
  ('ARI-SST-06','Saya hanya membaca sekali lalu berharap ingat saat ujian tanpa latihan lebih lanjut.','UF',20,'SST'),
  ('ARI-SST-07','Saya tidak pernah membuat perencanaan belajar yang terstruktur sebelumnya.','UF',21,'SST'),
  ('ARI-AMO-01','Saya memiliki target nilai dan standar akademik yang jelas yang ingin saya capai.','F',22,'AMO'),
  ('ARI-AMO-02','Saya merasakan kepuasan tersendiri ketika berhasil memahami materi yang sulit.','F',23,'AMO'),
  ('ARI-AMO-03','Saya belajar bukan hanya karena ingin lulus, tapi karena ingin benar-benar memahami ilmunya.','F',24,'AMO'),
  ('ARI-AMO-04','Prestasi akademik yang baik penting bagi saya karena mendukung cita-cita saya menjadi taruna.','F',25,'AMO'),
  ('ARI-AMO-05','Rasa ingin tahu saya mendorong saya untuk mencari tahu lebih banyak tentang materi pelajaran.','F',26,'AMO'),
  ('ARI-AMO-06','Saya belajar hanya ketika mendekati ujian atau karena dipaksa oleh orang tua.','UF',27,'AMO'),
  ('ARI-AMO-07','Bagi saya, yang penting lulus saja, tidak perlu nilai yang sangat tinggi.','UF',28,'AMO'),
  ('ARI-SLA-01','Saya mencari bahan belajar tambahan dari internet, buku, atau video tanpa harus diminta.','F',29,'SLA'),
  ('ARI-SLA-02','Ketika ada yang tidak saya mengerti, saya berusaha mencari jawaban sendiri sebelum bertanya.','F',30,'SLA'),
  ('ARI-SLA-03','Saya belajar materi seleksi taruna secara mandiri di luar waktu bimbingan belajar.','F',31,'SLA'),
  ('ARI-SLA-04','Saya mengevaluasi sendiri kemajuan belajar saya dan menyesuaikan strategi jika perlu.','F',32,'SLA'),
  ('ARI-SLA-05','Saya tidak menunggu guru untuk menjelaskan; saya berusaha memahami materi terlebih dahulu.','F',33,'SLA'),
  ('ARI-SLA-06','Saya sangat bergantung pada guru atau tutor untuk bisa memahami materi pelajaran.','UF',34,'SLA'),
  ('ARI-SLA-07','Saya jarang belajar di luar jam pelajaran atau bimbingan karena tidak tahu harus mulai dari mana.','UF',35,'SLA')
) AS x(qc,qt,dir,sq,dc) ON true
JOIN public.assessment_dimensions di ON di.module_id = mo.id AND di.code = x.dc
WHERE mo.code = 'ARI'
ON CONFLICT (module_id, code) DO NOTHING;

-- Questions: PPR (Physical Preparation Readiness)
INSERT INTO public.assessment_questions (module_id, dimension_id, code, text, direction, sequence)
SELECT mo.id, di.id, x.qc, x.qt, x.dir, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('PPR-EXH-01','Saya berolahraga minimal 3–4 kali seminggu secara rutin.','F',1,'EXH'),
  ('PPR-EXH-02','Program latihan fisik saya terstruktur dan terarah sesuai target kebugaran saya.','F',2,'EXH'),
  ('PPR-EXH-03','Saya berlatih fisik (lari, push-up, pull-up, dll.) secara mandiri untuk persiapan seleksi.','F',3,'EXH'),
  ('PPR-EXH-04','Saya meningkatkan intensitas latihan saya secara bertahap setiap minggu.','F',4,'EXH'),
  ('PPR-EXH-05','Saya memiliki target fisik yang jelas (misalnya waktu lari, jumlah push-up) yang ingin saya capai.','F',5,'EXH'),
  ('PPR-EXH-06','Saya jarang berolahraga kecuali ada pelajaran olahraga di sekolah.','UF',6,'EXH'),
  ('PPR-EXH-07','Program latihan fisik saya tidak terstruktur; saya berlatih hanya sesekali dan tidak terencana.','UF',7,'EXH'),
  ('PPR-SLQ-01','Saya tidur selama 7–9 jam setiap malam secara teratur.','F',8,'SLQ'),
  ('PPR-SLQ-02','Saya tidur dan bangun di waktu yang sama setiap hari termasuk akhir pekan.','F',9,'SLQ'),
  ('PPR-SLQ-03','Saya bangun pagi dalam keadaan segar dan siap beraktivitas tanpa perlu kafein berlebihan.','F',10,'SLQ'),
  ('PPR-SLQ-04','Saya menghindari penggunaan gadget minimal 30 menit sebelum tidur.','F',11,'SLQ'),
  ('PPR-SLQ-05','Pola tidur saya mendukung pemulihan fisik sehingga saya siap berlatih keesokan harinya.','F',12,'SLQ'),
  ('PPR-SLQ-06','Saya sering begadang hingga larut malam untuk bermain game, media sosial, atau aktivitas non-produktif.','UF',13,'SLQ'),
  ('PPR-SLQ-07','Pola tidur saya tidak teratur; kadang tidur sangat larut, kadang sangat awal.','UF',14,'SLQ'),
  ('PPR-NUT-01','Saya sarapan setiap pagi untuk memastikan energi cukup untuk beraktivitas.','F',15,'NUT'),
  ('PPR-NUT-02','Saya memastikan asupan makan saya mencukupi kebutuhan protein dan karbohidrat untuk latihan.','F',16,'NUT'),
  ('PPR-NUT-03','Saya minum air putih yang cukup setiap hari, terutama sebelum dan setelah latihan.','F',17,'NUT'),
  ('PPR-NUT-04','Saya mengurangi konsumsi makanan cepat saji, minuman manis, dan junk food.','F',18,'NUT'),
  ('PPR-NUT-05','Saya memperhatikan pola makan saya sebagai bagian dari persiapan fisik menuju seleksi.','F',19,'NUT'),
  ('PPR-NUT-06','Saya jarang sarapan dan sering melewatkan waktu makan yang penting.','UF',20,'NUT'),
  ('PPR-NUT-07','Saya tidak memperhatikan apa yang saya makan; yang penting kenyang.','UF',21,'NUT'),
  ('PPR-PHC-01','Saya berlatih fisik meskipun cuaca buruk atau kondisi tidak ideal.','F',22,'PHC'),
  ('PPR-PHC-02','Saya jarang melewatkan sesi latihan fisik tanpa alasan yang benar-benar mendesak.','F',23,'PHC'),
  ('PPR-PHC-03','Saya tetap menjalani program latihan meski hasil belum terlihat signifikan.','F',24,'PHC'),
  ('PPR-PHC-04','Saya memiliki jadwal latihan mingguan yang saya patuhi secara konsisten.','F',25,'PHC'),
  ('PPR-PHC-05','Saya sering skip latihan fisik ketika merasa malas, lelah, atau tidak ada yang mendorong.','UF',26,'PHC'),
  ('PPR-PHC-06','Program latihan saya sering terputus berhari-hari atau berminggu-minggu tanpa alasan kuat.','UF',27,'PHC'),
  ('PPR-HLR-01','Saya segera berkonsultasi ke dokter atau petugas kesehatan ketika merasakan gangguan fisik.','F',28,'HLR'),
  ('PPR-HLR-02','Saya tidak mengabaikan cedera atau nyeri fisik dan segera menanganinya dengan benar.','F',29,'HLR'),
  ('PPR-HLR-03','Saya aktif memonitor kondisi fisik saya sebagai bagian dari persiapan seleksi taruna.','F',30,'HLR'),
  ('PPR-HLR-04','Saya menjaga gaya hidup yang mendukung kesehatan fisik jangka panjang saya.','F',31,'HLR'),
  ('PPR-HLR-05','Saya memandang tubuh yang sehat sebagai aset utama untuk mencapai cita-cita sebagai taruna.','F',32,'HLR'),
  ('PPR-HLR-06','Saya sering mengabaikan rasa sakit atau cedera ringan dan memaksakan diri terus berlatih.','UF',33,'HLR'),
  ('PPR-HLR-07','Saya jarang memeriksakan kesehatan dan baru ke dokter jika kondisi sudah sangat parah.','UF',34,'HLR')
) AS x(qc,qt,dir,sq,dc) ON true
JOIN public.assessment_dimensions di ON di.module_id = mo.id AND di.code = x.dc
WHERE mo.code = 'PPR'
ON CONFLICT (module_id, code) DO NOTHING;

-- Questions: SPI (Stress & Pressure Index)
INSERT INTO public.assessment_questions (module_id, dimension_id, code, text, direction, sequence)
SELECT mo.id, di.id, x.qc, x.qt, x.dir, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('SPI-EXA-01','Jantung saya berdebar sangat kencang ketika ujian atau tes seleksi dimulai.','UF',1,'EXA'),
  ('SPI-EXA-02','Saya merasa pikiran saya menjadi kosong saat menghadapi soal ujian penting.','UF',2,'EXA'),
  ('SPI-EXA-03','Saya sulit tidur malam sebelum hari ujian atau tes seleksi besar.','UF',3,'EXA'),
  ('SPI-EXA-04','Kecemasan saya saat ujian membuat performa saya jauh lebih buruk dari kemampuan asli saya.','UF',4,'EXA'),
  ('SPI-EXA-05','Saya bisa mengerjakan ujian dengan tenang meskipun taruhannya sangat besar.','F',5,'EXA'),
  ('SPI-EXA-06','Saya menghadapi tes seleksi dengan percaya diri karena saya sudah mempersiapkan diri dengan baik.','F',6,'EXA'),
  ('SPI-FOF-01','Rasa takut gagal membuat saya tidak berani mencoba sesuatu yang penting bagi saya.','UF',7,'FOF'),
  ('SPI-FOF-02','Saya menghindari situasi kompetitif karena tidak ingin mengalami kegagalan.','UF',8,'FOF'),
  ('SPI-FOF-03','Pikiran tentang kemungkinan gagal membuat saya tidak bisa berkonsentrasi belajar.','UF',9,'FOF'),
  ('SPI-FOF-04','Saya merasa sangat malu jika gagal sehingga lebih baik tidak mencoba sama sekali.','UF',10,'FOF'),
  ('SPI-FOF-05','Saya menerima kegagalan sebagai bagian normal dari proses belajar tanpa merasa terpuruk.','F',11,'FOF'),
  ('SPI-FOF-06','Saya berani mengikuti seleksi meskipun ada kemungkinan tidak lulus.','F',12,'FOF'),
  ('SPI-OVT-01','Pikiran saya sering berputar-putar memikirkan hal yang sama berkali-kali tanpa solusi.','UF',13,'OVT'),
  ('SPI-OVT-02','Saya menghabiskan banyak waktu memikirkan skenario terburuk yang mungkin terjadi.','UF',14,'OVT'),
  ('SPI-OVT-03','Saya sulit berhenti memikirkan masalah meskipun sudah mencoba.','UF',15,'OVT'),
  ('SPI-OVT-04','Saya sering tidak bisa tidur karena pikiran saya tidak bisa berhenti berputar.','UF',16,'OVT'),
  ('SPI-OVT-05','Saya bisa menghentikan pikiran negatif yang berulang dan menggantinya dengan pikiran yang lebih produktif.','F',17,'OVT'),
  ('SPI-FPR-01','Saya merasa beban ekspektasi keluarga terhadap saya sangat berat dan menekan.','UF',18,'FPR'),
  ('SPI-FPR-02','Saya merasa pilihan karier saya lebih ditentukan oleh keinginan keluarga daripada keinginan saya sendiri.','UF',19,'FPR'),
  ('SPI-FPR-03','Saya takut mengecewakan orang tua sehingga tekanan itu membuat saya tidak bisa berpikir jernih.','UF',20,'FPR'),
  ('SPI-FPR-04','Konflik atau perbedaan pendapat dengan keluarga tentang masa depan saya sangat mengganggu saya.','UF',21,'FPR'),
  ('SPI-FPR-05','Dukungan keluarga membuat saya lebih bersemangat, bukan tertekan.','F',22,'FPR'),
  ('SPI-FPR-06','Saya bisa memilih jalur karier saya dengan keyakinan sendiri meskipun keluarga punya pendapat berbeda.','F',23,'FPR'),
  ('SPI-EST-01','Saya sering merasa kelelahan secara emosional bahkan tanpa aktivitas fisik yang berat.','UF',24,'EST'),
  ('SPI-EST-02','Mood saya sangat tidak stabil dan mudah berubah tergantung hal-hal kecil.','UF',25,'EST'),
  ('SPI-EST-03','Saya merasa kewalahan dengan semua hal yang harus saya hadapi sekaligus.','UF',26,'EST'),
  ('SPI-EST-04','Saya kehilangan semangat dan antusiasme dalam menjalani hari-hari persiapan seleksi saya.','UF',27,'EST'),
  ('SPI-EST-05','Saya merasa cukup baik secara emosional dan mampu mengelola berbagai tekanan yang ada.','F',28,'EST'),
  ('SPI-EST-06','Saya masih bisa menikmati aktivitas yang saya sukai meskipun sedang dalam proses persiapan seleksi.','F',29,'EST')
) AS x(qc,qt,dir,sq,dc) ON true
JOIN public.assessment_dimensions di ON di.module_id = mo.id AND di.code = x.dc
WHERE mo.code = 'SPI'
ON CONFLICT (module_id, code) DO NOTHING;

-- Questions: TCI (Taruna Commitment Index)
INSERT INTO public.assessment_questions (module_id, dimension_id, code, text, direction, sequence)
SELECT mo.id, di.id, x.qc, x.qt, x.dir, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('TCI-MTC-01','Saya bisa menjelaskan dengan jelas mengapa saya ingin menjadi taruna, bukan hanya karena ikut-ikutan.','F',1,'MTC'),
  ('TCI-MTC-02','Keinginan saya masuk ke institusi kedinasan datang dari dalam diri saya sendiri, bukan paksaan.','F',2,'MTC'),
  ('TCI-MTC-03','Saya sudah memikirkan dengan matang konsekuensi dari pilihan menjadi taruna, termasuk risikonya.','F',3,'MTC'),
  ('TCI-MTC-04','Saya memiliki alasan yang kuat dan bermakna yang akan memotivasi saya saat masa pendidikan terasa berat.','F',4,'MTC'),
  ('TCI-MTC-05','Motivasi saya sudah melewati fase ''keren-kerenan'' dan menuju ke komitmen yang sesungguhnya.','F',5,'MTC'),
  ('TCI-MTC-06','Jujur, alasan saya ingin jadi taruna masih sangat kabur dan belum saya pikirkan secara serius.','UF',6,'MTC'),
  ('TCI-MTC-07','Saya memilih jalur ini lebih karena tekanan dari orang tua atau lingkungan, bukan keinginan sendiri.','UF',7,'MTC'),
  ('TCI-CAW-01','Saya memahami alur seleksi, sistem pendidikan, dan kehidupan di dalam institusi yang saya tuju.','F',8,'CAW'),
  ('TCI-CAW-02','Saya tahu apa saja tugas, risiko, dan tanggung jawab dari karier yang akan saya jalani.','F',9,'CAW'),
  ('TCI-CAW-03','Ekspektasi saya tentang kehidupan taruna sudah realistis, bukan hanya berdasarkan film atau cerita orang.','F',10,'CAW'),
  ('TCI-CAW-04','Saya sudah melakukan riset mendalam tentang institusi dan jalur karier yang saya tuju.','F',11,'CAW'),
  ('TCI-CAW-05','Saya tahu apa yang harus saya siapkan sejak sekarang untuk berhasil dalam seleksi.','F',12,'CAW'),
  ('TCI-CAW-06','Saya tidak terlalu tahu detail tentang proses seleksi atau kehidupan di dalam institusi yang saya tuju.','UF',13,'CAW'),
  ('TCI-CAW-07','Gambaran saya tentang menjadi taruna masih sangat ideal dan mungkin tidak realistis.','UF',14,'CAW'),
  ('TCI-LTC-01','Saya siap menjalani masa pendidikan yang keras, panjang, dan penuh aturan ketat.','F',15,'LTC'),
  ('TCI-LTC-02','Saya berkomitmen untuk menyelesaikan seluruh masa pendidikan meskipun sangat berat.','F',16,'LTC'),
  ('TCI-LTC-03','Saya siap menjalani karier di bidang ini selama puluhan tahun, bukan hanya beberapa tahun.','F',17,'LTC'),
  ('TCI-LTC-04','Saya siap mengorbankan kebebasan dan kenyamanan pribadi demi jalur karier ini.','F',18,'LTC'),
  ('TCI-LTC-05','Jika pendidikan terasa terlalu berat, saya akan mempertimbangkan untuk berhenti.','UF',19,'LTC'),
  ('TCI-LTC-06','Saya belum yakin apakah saya bisa bertahan dengan aturan dan tekanan selama bertahun-tahun.','UF',20,'LTC'),
  ('TCI-VAL-01','Nilai-nilai seperti kejujuran, kedisiplinan, dan pengabdian sudah menjadi bagian dari diri saya.','F',21,'VAL'),
  ('TCI-VAL-02','Saya menghormati sistem hierarki dan otoritas karena saya percaya itu penting dalam organisasi.','F',22,'VAL'),
  ('TCI-VAL-03','Saya bangga dengan nilai-nilai korsa, kehormatan, dan integritas yang dijunjung institusi ini.','F',23,'VAL'),
  ('TCI-VAL-04','Nilai pengabdian dan kepentingan negara di atas kepentingan pribadi sudah saya yakini sepenuhnya.','F',24,'VAL'),
  ('TCI-VAL-05','Saya tidak merasa terpaksa mengikuti nilai-nilai tersebut karena memang sesuai dengan prinsip hidup saya.','F',25,'VAL'),
  ('TCI-VAL-06','Saya kurang yakin apakah nilai-nilai dalam institusi ini benar-benar sesuai dengan kepribadian saya.','UF',26,'VAL'),
  ('TCI-SVO-01','Saya bermotivasi menjadi taruna karena ingin berkontribusi nyata bagi masyarakat dan bangsa.','F',27,'SVO'),
  ('TCI-SVO-02','Kepuasan terbesar saya adalah ketika bisa membantu dan melindungi orang banyak.','F',28,'SVO'),
  ('TCI-SVO-03','Saya siap menempatkan kepentingan negara dan masyarakat di atas kepentingan pribadi saya.','F',29,'SVO'),
  ('TCI-SVO-04','Rasa cinta tanah air dan keinginan membela negara adalah bagian dari motivasi saya.','F',30,'SVO'),
  ('TCI-SVO-05','Saya memandang profesi ini sebagai panggilan jiwa untuk mengabdi, bukan sekadar pekerjaan.','F',31,'SVO'),
  ('TCI-SVO-06','Motivasi utama saya lebih pada keuntungan materi atau status sosial, bukan pengabdian.','UF',32,'SVO'),
  ('TCI-SVO-07','Saya kurang merasa terpanggil untuk mengabdi; ini lebih pilihan praktis bagi saya.','UF',33,'SVO')
) AS x(qc,qt,dir,sq,dc) ON true
JOIN public.assessment_dimensions di ON di.module_id = mo.id AND di.code = x.dc
WHERE mo.code = 'TCI'
ON CONFLICT (module_id, code) DO NOTHING;

-- Questions: MHS (Mental Health Screener)
INSERT INTO public.assessment_questions (module_id, dimension_id, code, text, direction, sequence)
SELECT mo.id, di.id, x.qc, x.qt, x.dir, x.sq
FROM public.assessment_modules mo
JOIN (VALUES
  ('MHS-EWB-01','Dalam 2 minggu terakhir, saya sering merasa bahagia dan bersemangat menjalani hari.','F',1,'EWB'),
  ('MHS-EWB-02','Saya merasa kehidupan saya secara umum berjalan dengan cukup baik saat ini.','F',2,'EWB'),
  ('MHS-EWB-03','Saya memiliki energi yang cukup untuk menjalani aktivitas sehari-hari dengan baik.','F',3,'EWB'),
  ('MHS-EWB-04','Saya merasa optimis dan penuh harapan tentang masa depan saya.','F',4,'EWB'),
  ('MHS-EWB-05','Saya mampu menikmati hal-hal yang biasanya saya sukai, seperti hobi atau waktu bersama orang tersayang.','F',5,'EWB'),
  ('MHS-EWB-06','Dalam 2 minggu terakhir, saya lebih banyak merasa sedih atau hampa dari biasanya.','UF',6,'EWB'),
  ('MHS-EWB-07','Saya merasa kehilangan minat terhadap hal-hal yang biasanya membuat saya senang.','UF',7,'EWB'),
  ('MHS-SEE-01','Secara keseluruhan, saya merasa puas dengan diri saya sebagai pribadi.','F',8,'SEE'),
  ('MHS-SEE-02','Saya percaya bahwa saya memiliki kemampuan yang cukup untuk mencapai tujuan saya.','F',9,'SEE'),
  ('MHS-SEE-03','Saya menghargai dan menerima diri saya apa adanya, termasuk kekurangan yang saya miliki.','F',10,'SEE'),
  ('MHS-SEE-04','Saya tidak merasa lebih rendah atau kurang berharga dibandingkan orang lain.','F',11,'SEE'),
  ('MHS-SEE-05','Saya yakin bahwa saya bisa berkontribusi secara positif dalam kehidupan saya dan orang-orang di sekitar.','F',12,'SEE'),
  ('MHS-SEE-06','Saya sering merasa tidak cukup baik, tidak layak, atau tidak pantas mendapatkan hal-hal baik.','UF',13,'SEE'),
  ('MHS-SEE-07','Saya banyak mengkritik diri sendiri dan merasa diri saya adalah beban bagi orang lain.','UF',14,'SEE'),
  ('MHS-ANX-01','Dalam 2 minggu terakhir, saya sering merasa sangat cemas atau khawatir tanpa alasan yang jelas.','UF',15,'ANX'),
  ('MHS-ANX-02','Saya sulit mengendalikan rasa khawatir meskipun sudah mencoba untuk rileks.','UF',16,'ANX'),
  ('MHS-ANX-03','Tubuh saya sering menunjukkan gejala fisik kecemasan seperti jantung berdebar, keringat dingin, atau sesak nafas.','UF',17,'ANX'),
  ('MHS-ANX-04','Saya merasa sangat mudah tersinggung dan gelisah bahkan untuk hal-hal kecil.','UF',18,'ANX'),
  ('MHS-ANX-05','Saya bisa mengelola kekhawatiran saya dengan cara yang sehat dan efektif.','F',19,'ANX'),
  ('MHS-ANX-06','Saya merasa cukup tenang dan tidak terlalu khawatir tentang hal-hal yang belum pasti.','F',20,'ANX'),
  ('MHS-RSL-01','Ketika menghadapi masa-masa sulit, saya bisa bangkit dan melanjutkan hidup dengan baik.','F',21,'RSL'),
  ('MHS-RSL-02','Saya percaya bahwa saya cukup kuat untuk menghadapi tantangan yang datang.','F',22,'RSL'),
  ('MHS-RSL-03','Saya bisa menemukan makna positif dari pengalaman sulit yang saya jalani.','F',23,'RSL'),
  ('MHS-RSL-04','Saya tidak mudah jatuh terpuruk oleh tekanan karena saya memiliki sumber daya internal yang cukup.','F',24,'RSL'),
  ('MHS-RSL-05','Saya merasa tidak mampu menghadapi kesulitan dan sering merasa putus asa.','UF',25,'RSL'),
  ('MHS-RSL-06','Setiap kali sesuatu yang buruk terjadi, saya merasa sangat lama untuk bisa kembali normal.','UF',26,'RSL'),
  ('MHS-SSP-01','Ada orang-orang di sekitar saya (keluarga atau teman) yang benar-benar peduli dan mendukung saya.','F',27,'SSP'),
  ('MHS-SSP-02','Ketika saya dalam kesulitan, saya tahu ke mana atau kepada siapa saya bisa meminta bantuan.','F',28,'SSP'),
  ('MHS-SSP-03','Saya merasa memiliki koneksi sosial yang bermakna dan tidak merasa sendirian.','F',29,'SSP'),
  ('MHS-SSP-04','Ada orang yang bisa saya ajak bicara secara terbuka tentang perasaan dan masalah saya.','F',30,'SSP'),
  ('MHS-SSP-05','Dukungan dari orang-orang terdekat membuat saya merasa lebih kuat menghadapi tantangan.','F',31,'SSP'),
  ('MHS-SSP-06','Saya sering merasa sangat sendirian dan tidak ada yang benar-benar memahami apa yang saya rasakan.','UF',32,'SSP'),
  ('MHS-SSP-07','Saya merasa tidak ada orang yang bisa saya percaya untuk berbagi masalah yang sesungguhnya.','UF',33,'SSP')
) AS x(qc,qt,dir,sq,dc) ON true
JOIN public.assessment_dimensions di ON di.module_id = mo.id AND di.code = x.dc
WHERE mo.code = 'MHS'
ON CONFLICT (module_id, code) DO NOTHING;
