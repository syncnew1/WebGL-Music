-- 20260331_history_private_per_user.sql
-- 目的：播放历史按用户隔离存储，禁止公开读取

alter table public.playback_history
  alter column user_id set default auth.uid();

alter table public.playback_history enable row level security;

drop policy if exists "history_owner_access" on public.playback_history;
drop policy if exists "history_select_own" on public.playback_history;
drop policy if exists "history_insert_own" on public.playback_history;
drop policy if exists "history_update_own" on public.playback_history;
drop policy if exists "history_delete_own" on public.playback_history;

create policy "history_select_own" on public.playback_history
  for select to authenticated using (user_id = auth.uid());

create policy "history_insert_own" on public.playback_history
  for insert to authenticated with check (user_id = auth.uid());

create policy "history_update_own" on public.playback_history
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "history_delete_own" on public.playback_history
  for delete to authenticated using (user_id = auth.uid());
