-- 20260331_audio_read_policy_for_authenticated.sql
-- 目的：允许已登录用户播放共享音频，修复新用户无权限播放问题

-- 1) 允许 authenticated 读取 audio bucket 对象（用于 createSignedUrl / download / 直接访问）
drop policy if exists "storage_read_audio_authenticated" on storage.objects;
create policy "storage_read_audio_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'audio');

-- 2) 将历史歌曲标记为公开（否则 RLS 下新用户查询不到）
update public.songs
set is_public = true
where is_public is distinct from true;
