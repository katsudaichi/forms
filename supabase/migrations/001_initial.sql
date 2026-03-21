create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  header_title text not null default '',
  header_subtitle text not null default '',
  description text not null default '',
  header_image_url text,
  field_config jsonb not null default '[]'::jsonb,
  post_template jsonb not null default '[]'::jsonb,
  composite_template jsonb not null default '{}'::jsonb,
  col_widths jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  per_image_tpls jsonb,
  is_dirty boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.response_images (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  storage_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists forms_set_updated_at on public.forms;
create trigger forms_set_updated_at
before update on public.forms
for each row execute procedure public.set_updated_at();

drop trigger if exists responses_set_updated_at on public.responses;
create trigger responses_set_updated_at
before update on public.responses
for each row execute procedure public.set_updated_at();

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.forms enable row level security;
alter table public.responses enable row level security;
alter table public.response_images enable row level security;

drop policy if exists "authenticated users can create tenants" on public.tenants;
create policy "authenticated users can create tenants"
on public.tenants
for insert
to authenticated
with check (true);

drop policy if exists "members can read own tenants" on public.tenants;
create policy "members can read own tenants"
on public.tenants
for select
to authenticated
using (
  id in (
    select tenant_id
    from public.tenant_members
    where user_id = auth.uid()
  )
);

drop policy if exists "tenant members can insert themselves" on public.tenant_members;
create policy "tenant members can insert themselves"
on public.tenant_members
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "members can read tenant memberships" on public.tenant_members;
create policy "members can read tenant memberships"
on public.tenant_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "members can manage own tenant forms" on public.forms;
create policy "members can manage own tenant forms"
on public.forms
for all
to authenticated
using (
  tenant_id in (
    select tenant_id
    from public.tenant_members
    where user_id = auth.uid()
  )
)
with check (
  tenant_id in (
    select tenant_id
    from public.tenant_members
    where user_id = auth.uid()
  )
);

drop policy if exists "public can read open forms" on public.forms;
create policy "public can read open forms"
on public.forms
for select
to anon, authenticated
using (status = 'open');

drop policy if exists "members can manage responses" on public.responses;
create policy "members can manage responses"
on public.responses
for all
to authenticated
using (
  form_id in (
    select id
    from public.forms
    where tenant_id in (
      select tenant_id
      from public.tenant_members
      where user_id = auth.uid()
    )
  )
)
with check (
  form_id in (
    select id
    from public.forms
    where tenant_id in (
      select tenant_id
      from public.tenant_members
      where user_id = auth.uid()
    )
  )
);

drop policy if exists "public can submit to open forms" on public.responses;
create policy "public can submit to open forms"
on public.responses
for insert
to anon, authenticated
with check (
  form_id in (
    select id
    from public.forms
    where status = 'open'
  )
);

drop policy if exists "members can read response images" on public.response_images;
create policy "members can read response images"
on public.response_images
for select
to authenticated
using (
  response_id in (
    select r.id
    from public.responses r
    join public.forms f on f.id = r.form_id
    join public.tenant_members tm on tm.tenant_id = f.tenant_id
    where tm.user_id = auth.uid()
  )
);

drop policy if exists "public can upload response images rows" on public.response_images;
create policy "public can upload response images rows"
on public.response_images
for insert
to anon, authenticated
with check (true);

insert into storage.buckets (id, name, public)
values ('response-images', 'response-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('form-assets', 'form-assets', true)
on conflict (id) do nothing;

drop policy if exists "public can upload response images" on storage.objects;
create policy "public can upload response images"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'response-images');

drop policy if exists "public can view response images" on storage.objects;
create policy "public can view response images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'response-images');

drop policy if exists "admins can upload form assets" on storage.objects;
create policy "admins can upload form assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'form-assets');

drop policy if exists "public can view form assets" on storage.objects;
create policy "public can view form assets"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'form-assets');
