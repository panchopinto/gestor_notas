
-- Esquema base sugerido para migración a Supabase
-- Ejecutar en SQL Editor

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin','teacher','student','utp')),
  created_at timestamptz default now()
);

create table if not exists public.students (
  rut text primary key,
  full_name text not null,
  email text,
  course text not null,
  status text,
  pie boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.subjects (
  id bigserial primary key,
  course text not null,
  subject_name text not null,
  created_at timestamptz default now(),
  unique(course, subject_name)
);

create table if not exists public.assessment_configs (
  id bigserial primary key,
  course text not null,
  semester smallint not null check (semester in (1,2)),
  subject_name text not null,
  assessment_key text not null,
  assessment_name text not null,
  weight numeric(5,2) not null default 20,
  requirement numeric(5,2) not null default 60,
  total_points numeric(8,2) not null default 40,
  created_at timestamptz default now(),
  unique(course, semester, subject_name, assessment_key)
);

create table if not exists public.grades (
  id bigserial primary key,
  student_rut text not null references public.students(rut) on delete cascade,
  course text not null,
  semester smallint not null check (semester in (1,2)),
  subject_name text not null,
  procedimental numeric(3,1),
  actitudinal numeric(3,1),
  observation text,
  created_by uuid references public.profiles(id),
  updated_at timestamptz default now(),
  unique(student_rut, course, semester, subject_name)
);

create table if not exists public.assessment_scores (
  id bigserial primary key,
  grade_id bigint not null references public.grades(id) on delete cascade,
  assessment_key text not null,
  obtained_points numeric(8,2),
  updated_at timestamptz default now(),
  unique(grade_id, assessment_key)
);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.assessment_configs enable row level security;
alter table public.grades enable row level security;
alter table public.assessment_scores enable row level security;

create policy "authenticated read profiles" on public.profiles
for select to authenticated using (true);

create policy "authenticated read students" on public.students
for select to authenticated using (true);

create policy "authenticated read subjects" on public.subjects
for select to authenticated using (true);

create policy "authenticated read configs" on public.assessment_configs
for select to authenticated using (true);

create policy "authenticated read grades" on public.grades
for select to authenticated using (true);

create policy "authenticated read scores" on public.assessment_scores
for select to authenticated using (true);

create policy "teachers manage grades" on public.grades
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher','admin','utp')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher','admin','utp')));

create policy "teachers manage scores" on public.assessment_scores
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher','admin','utp')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher','admin','utp')));

create policy "admins manage subjects" on public.subjects
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','utp')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','utp')));

create policy "admins manage configs" on public.assessment_configs
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','utp')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','utp')));
