drop policy if exists "members can manage responses" on public.responses;
create policy "members can manage responses"
on public.responses
for all
to authenticated
using (
  exists (
    select 1
    from public.forms f
    join public.tenant_members tm on tm.tenant_id = f.tenant_id
    where f.id = responses.form_id
      and tm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.forms f
    join public.tenant_members tm on tm.tenant_id = f.tenant_id
    where f.id = responses.form_id
      and tm.user_id = auth.uid()
  )
);

drop policy if exists "public can submit to open forms" on public.responses;
create policy "public can submit to open forms"
on public.responses
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.forms f
    where f.id = responses.form_id
      and f.status = 'open'
  )
);

drop policy if exists "admins can update form assets" on storage.objects;
create policy "admins can update form assets"
on storage.objects
for update
to authenticated
using (bucket_id = 'form-assets')
with check (bucket_id = 'form-assets');

drop policy if exists "admins can delete form assets" on storage.objects;
create policy "admins can delete form assets"
on storage.objects
for delete
to authenticated
using (bucket_id = 'form-assets');
