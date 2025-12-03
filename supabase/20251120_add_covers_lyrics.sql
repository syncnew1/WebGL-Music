alter table public.songs add column if not exists cover_storage_path text;
alter table public.songs add column if not exists cover_url text;
alter table public.songs add column if not exists lyrics text;

insert into storage.buckets (id, name, public) values ('covers','covers', false)
on conflict (id) do nothing;

drop policy if exists "storage_read_own_or_signed" on storage.objects;
create policy "storage_read_own_or_signed" on storage.objects
  for select to authenticated using ((bucket_id = 'audio' or bucket_id = 'covers') and (owner = auth.uid()));

drop policy if exists "storage_upload_own" on storage.objects;
create policy "storage_upload_own" on storage.objects
  for insert to authenticated with check ((bucket_id = 'audio' or bucket_id = 'covers') and owner = auth.uid());

drop policy if exists "storage_delete_own" on storage.objects;
create policy "storage_delete_own" on storage.objects
  for delete to authenticated using ((bucket_id = 'audio' or bucket_id = 'covers') and (owner = auth.uid()));