-- ============ ENUMS ============
create type public.app_role as enum ('admin','reviewer','participant');
create type public.progress_status as enum ('not_started','in_progress','completed');
create type public.session_status as enum ('in_progress','completed');
create type public.item_direction as enum ('F','UF');
create type public.content_status as enum ('draft','published','archived');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  age int,
  education_level text,
  target_institution text,
  target_program text,
  city text,
  guardian_contact text,
  consent_version text,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

-- ============ ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles select" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "admins read roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "admins read profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'reviewer'));

-- ============ CONTENT VERSIONS ============
create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  status public.content_status not null default 'draft',
  notes text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.content_versions to authenticated;
grant all on public.content_versions to service_role;
alter table public.content_versions enable row level security;
create policy "read versions" on public.content_versions for select to authenticated using (true);
create policy "admins write versions" on public.content_versions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ MODULES ============
create table public.assessment_modules (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.content_versions(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  sequence int not null,
  estimated_minutes int not null default 8,
  is_sensitive boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (version_id, code),
  unique (version_id, sequence)
);
grant select on public.assessment_modules to authenticated;
grant all on public.assessment_modules to service_role;
alter table public.assessment_modules enable row level security;
create policy "read modules" on public.assessment_modules for select to authenticated using (true);
create policy "admins write modules" on public.assessment_modules for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ DIMENSIONS ============
create table public.assessment_dimensions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.assessment_modules(id) on delete cascade,
  code text not null,
  name text not null,
  description text not null default '',
  sequence int not null,
  unique (module_id, code)
);
create index on public.assessment_dimensions(module_id);
grant select on public.assessment_dimensions to authenticated;
grant all on public.assessment_dimensions to service_role;
alter table public.assessment_dimensions enable row level security;
create policy "read dimensions" on public.assessment_dimensions for select to authenticated using (true);
create policy "admins write dimensions" on public.assessment_dimensions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ QUESTIONS ============
create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.assessment_modules(id) on delete cascade,
  dimension_id uuid not null references public.assessment_dimensions(id) on delete cascade,
  code text not null,
  text text not null,
  direction public.item_direction not null,
  sequence int not null,
  active boolean not null default true,
  unique (module_id, code),
  unique (module_id, sequence)
);
create index on public.assessment_questions(module_id, sequence);
grant select on public.assessment_questions to authenticated;
grant all on public.assessment_questions to service_role;
alter table public.assessment_questions enable row level security;
create policy "read questions" on public.assessment_questions for select to authenticated using (true);
create policy "admins write questions" on public.assessment_questions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ INTERPRETATION BANDS ============
create table public.interpretation_bands (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.assessment_modules(id) on delete cascade,
  scope text not null default 'module',
  category text not null,
  min_score numeric not null,
  max_score numeric not null,
  interpretation text not null default '',
  sequence int not null default 1
);
grant select on public.interpretation_bands to authenticated;
grant all on public.interpretation_bands to service_role;
alter table public.interpretation_bands enable row level security;
create policy "read bands" on public.interpretation_bands for select to authenticated using (true);
create policy "admins write bands" on public.interpretation_bands for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ RECOMMENDATIONS LIBRARY ============
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.assessment_modules(id) on delete cascade,
  category text,
  title text not null,
  body text not null default '',
  priority int not null default 1,
  active boolean not null default true
);
grant select on public.recommendations to authenticated;
grant all on public.recommendations to service_role;
alter table public.recommendations enable row level security;
create policy "read recommendations" on public.recommendations for select to authenticated using (true);
create policy "admins write recommendations" on public.recommendations for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ SUPPORT CONTACTS (MHS) ============
create table public.support_contacts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  description text not null default '',
  phone text,
  url text,
  active boolean not null default true,
  sequence int not null default 1
);
grant select on public.support_contacts to authenticated;
grant all on public.support_contacts to service_role;
alter table public.support_contacts enable row level security;
create policy "read contacts" on public.support_contacts for select to authenticated using (true);
create policy "admins write contacts" on public.support_contacts for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ SESSIONS ============
create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version_id uuid not null references public.content_versions(id),
  status public.session_status not null default 'in_progress',
  scoring_calculated boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.assessment_sessions(user_id);
grant select, insert on public.assessment_sessions to authenticated;
grant all on public.assessment_sessions to service_role;
alter table public.assessment_sessions enable row level security;
create policy "own sessions select" on public.assessment_sessions for select to authenticated using (auth.uid() = user_id);
create policy "own sessions insert" on public.assessment_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy "staff read sessions" on public.assessment_sessions for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'reviewer'));

-- ============ MODULE PROGRESS ============
create table public.module_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  module_id uuid not null references public.assessment_modules(id) on delete cascade,
  status public.progress_status not null default 'not_started',
  answered_count int not null default 0,
  total_items int not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  unique (session_id, module_id)
);
create index on public.module_progress(session_id);
grant select on public.module_progress to authenticated;
grant all on public.module_progress to service_role;
alter table public.module_progress enable row level security;
create policy "own progress select" on public.module_progress for select to authenticated
  using (exists (select 1 from public.assessment_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "staff read progress" on public.module_progress for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'reviewer'));

-- ============ ANSWERS ============
create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  module_id uuid not null references public.assessment_modules(id) on delete cascade,
  answer_value int not null check (answer_value between 1 and 5),
  scored_value int not null default 0,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);
create index on public.assessment_answers(session_id, module_id);
grant select on public.assessment_answers to authenticated;
grant all on public.assessment_answers to service_role;
alter table public.assessment_answers enable row level security;
create policy "own answers select" on public.assessment_answers for select to authenticated
  using (exists (select 1 from public.assessment_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- ============ RESULTS ============
create table public.dimension_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  module_id uuid not null references public.assessment_modules(id) on delete cascade,
  dimension_id uuid not null references public.assessment_dimensions(id) on delete cascade,
  raw_score numeric not null,
  normalized_score numeric not null,
  status text not null,
  unique (session_id, dimension_id)
);
grant select on public.dimension_results to authenticated;
grant all on public.dimension_results to service_role;
alter table public.dimension_results enable row level security;
create policy "own dimension results" on public.dimension_results for select to authenticated
  using (exists (select 1 from public.assessment_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "staff read dimension results" on public.dimension_results for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'reviewer'));

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  module_id uuid not null references public.assessment_modules(id) on delete cascade,
  raw_score numeric not null,
  normalized_score numeric not null,
  category text not null,
  interpretation text not null default '',
  strongest_dimension_id uuid references public.assessment_dimensions(id),
  weakest_dimension_id uuid references public.assessment_dimensions(id),
  calculated_at timestamptz not null default now(),
  unique (session_id, module_id)
);
grant select on public.assessment_results to authenticated;
grant all on public.assessment_results to service_role;
alter table public.assessment_results enable row level security;
create policy "own module results" on public.assessment_results for select to authenticated
  using (exists (select 1 from public.assessment_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "staff read module results" on public.assessment_results for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'reviewer'));

create table public.overall_results (
  session_id uuid primary key references public.assessment_sessions(id) on delete cascade,
  readiness_score numeric not null,
  category text not null,
  interpretation text not null default '',
  calculated_at timestamptz not null default now()
);
grant select on public.overall_results to authenticated;
grant all on public.overall_results to service_role;
alter table public.overall_results enable row level security;
create policy "own overall result" on public.overall_results for select to authenticated
  using (exists (select 1 from public.assessment_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "staff read overall results" on public.overall_results for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'reviewer'));

create table public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.assessment_sessions(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
grant select on public.report_snapshots to authenticated;
grant all on public.report_snapshots to service_role;
alter table public.report_snapshots enable row level security;
create policy "own snapshot" on public.report_snapshots for select to authenticated
  using (exists (select 1 from public.assessment_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "staff read snapshots" on public.report_snapshots for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'reviewer'));

-- ============ AUDIT LOGS ============
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admins read audit" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));