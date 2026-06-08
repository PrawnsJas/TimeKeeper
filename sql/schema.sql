create extension if not exists "pgcrypto";

create table public.users (
  id text primary key,
  email text not null unique,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

create table public.dtr (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  time_in timestamptz,
  lunch_out timestamptz,
  lunch_in timestamptz,
  time_out timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger dtr_updated_at
  before update on public.dtr
  for each row
  execute function public.set_updated_at();
