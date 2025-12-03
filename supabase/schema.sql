create extension if not exists pgcrypto;

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  album text,
  duration numeric,
  tags text[],
  storage_path text,
  url text,
  cover_storage_path text,
  cover_url text,
  lyrics text,
  owner_id uuid default auth.uid(),
  is_public boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_public boolean default false,
  owner_id uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.playlist_songs (
  playlist_id uuid references public.playlists(id) on delete cascade,
  song_id uuid references public.songs(id) on delete cascade,
  sort_order int default 0,
  added_at timestamptz default now(),
  primary key (playlist_id, song_id)
);

alter table public.songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;

create policy "songs_owner_access" on public.songs
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "songs_read_public" on public.songs
  for select to authenticated using (is_public or owner_id = auth.uid());

create policy "playlists_owner_access" on public.playlists
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "playlists_read_public" on public.playlists
  for select to authenticated using (is_public or owner_id = auth.uid());

create policy "playlist_songs_owner_access" on public.playlist_songs
  for all to authenticated using (exists(select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()))
  with check (exists(select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid()));

insert into storage.buckets (id, name, public) values ('audio','audio', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('covers','covers', false)
on conflict (id) do nothing;

create policy "storage_read_own_or_signed" on storage.objects
  for select to authenticated using ((bucket_id = 'audio' or bucket_id = 'covers') and (owner = auth.uid()));
create policy "storage_upload_own" on storage.objects
  for insert to authenticated with check ((bucket_id = 'audio' or bucket_id = 'covers') and owner = auth.uid());
create policy "storage_delete_own" on storage.objects
  for delete to authenticated using ((bucket_id = 'audio' or bucket_id = 'covers') and owner = auth.uid());

create table if not exists public.playback_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  song_id uuid not null,
  played_at timestamptz default now(),
  played_ms numeric default 0,
  device text default 'browser'
);
alter table public.playback_history enable row level security;
create policy "history_owner_access" on public.playback_history
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.share_tokens (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('playlist')),
  resource_id uuid not null,
  token_hash text not null,
  expires_at timestamptz not null,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);
alter table public.share_tokens enable row level security;
create policy "share_owner_access" on public.share_tokens
  for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

-- shared playlist access via token
create or replace function public.get_shared_playlist(token text)
returns setof public.playlists
language sql security definer
as $$
  select p.* from public.playlists p
  join public.share_tokens st on st.resource_id = p.id
  where st.expires_at > now() and encode(digest(token, 'sha256'),'hex') = st.token_hash;
$$;
grant execute on function public.get_shared_playlist(text) to authenticated;

create or replace function public.get_shared_playlist_songs(token text)
returns table(song_id uuid)
language sql security definer
as $$
  select ps.song_id from public.playlist_songs ps
  join public.share_tokens st on st.resource_id = ps.playlist_id
  where st.expires_at > now() and encode(digest(token, 'sha256'),'hex') = st.token_hash;
$$;
grant execute on function public.get_shared_playlist_songs(text) to authenticated;

-- user profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_owner_access" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_read_all" on public.profiles
  for select to authenticated using (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();