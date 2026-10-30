-- Run once in the Supabase SQL Editor for the production project (EU region).
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  last_name text not null check (char_length(last_name) between 1 and 80),
  first_name text not null check (char_length(first_name) between 1 and 80),
  program text not null check (char_length(program) between 1 and 120),
  school_year text not null default '2026/2027' check (school_year = '2026/2027'),
  email text not null,
  phone text not null check (char_length(phone) between 1 and 30),
  level text not null check (level in ('1ère année', '2ème année', 'Bachelor')),
  sports jsonb not null check (jsonb_typeof(sports) = 'array' and jsonb_array_length(sports) > 0),
  consent boolean not null check (consent),
  consent_date timestamptz not null default now(),
  status text not null default 'included' check (status in ('included', 'excluded')),
  created_at timestamptz not null default now()
);

create unique index if not exists members_email_lower_unique on public.members (lower(email));
create index if not exists members_created_at_idx on public.members (created_at desc);

alter table public.members enable row level security;
revoke all on table public.members from anon, authenticated;
grant all on table public.members to service_role;

create table if not exists public.request_rate_limits (
  scope text not null check (scope in ('admin_login', 'public_register')),
  ip_hash text not null,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  primary key (scope, ip_hash)
);
alter table public.request_rate_limits enable row level security;
revoke all on table public.request_rate_limits from anon, authenticated;
grant all on table public.request_rate_limits to service_role;

create or replace function public.check_request_rate_limit(
  p_scope text, p_ip_hash text, p_limit integer, p_window_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
begin
  if p_scope not in ('admin_login', 'public_register') or p_limit < 1 or p_window_minutes < 1 then
    raise exception 'Invalid rate-limit parameters';
  end if;
  insert into public.request_rate_limits as limits (scope, ip_hash, window_started_at, attempts)
  values (p_scope, p_ip_hash, now(), 1)
  on conflict (scope, ip_hash) do update
    set attempts = case
      when limits.window_started_at < now() - make_interval(mins => p_window_minutes) then 1
      else limits.attempts + 1
    end,
    window_started_at = case
      when limits.window_started_at < now() - make_interval(mins => p_window_minutes) then now()
      else limits.window_started_at
    end
  returning attempts into current_attempts;

  delete from public.request_rate_limits
  where window_started_at < now() - interval '24 hours';

  return current_attempts <= p_limit;
end;
$$;

revoke all on function public.check_request_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_request_rate_limit(text, text, integer, integer) to service_role;
