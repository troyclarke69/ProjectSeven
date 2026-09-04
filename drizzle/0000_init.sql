-- Initial schema for Project Seven's multi-tenant Postgres store (Neon).
-- Run this once against your database, either via `npm run db:push`
-- (drizzle-kit) or by pasting it into the Neon SQL editor / psql.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null default '',
  description text not null default '',
  version text not null default '',
  platforms jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  start_date text not null,
  modified_at timestamptz not null default now(),
  github_url text not null default '',
  website_url text not null default '',
  status text not null default 'Planning',
  documentation text not null default '',
  documentation_updated_at timestamptz
);

create index if not exists projects_owner_id_idx on projects(owner_id);

create table if not exists documentation_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  owner_id uuid not null references users(id) on delete cascade,
  project_name text not null,
  documentation text not null,
  reason text not null,
  source text not null,
  created_at timestamptz not null default now(),
  repository text,
  branch text,
  commit_messages jsonb
);

create index if not exists documentation_history_project_id_idx on documentation_history(project_id);
create index if not exists documentation_history_owner_id_idx on documentation_history(owner_id);

create table if not exists effort_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  owner_id uuid not null references users(id) on delete cascade,
  project_name text not null,
  actor text not null,
  source text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null,
  notes text not null default '',
  idle_minutes_excluded integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists effort_entries_project_id_idx on effort_entries(project_id);
create index if not exists effort_entries_owner_id_idx on effort_entries(owner_id);
