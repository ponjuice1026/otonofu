-- 管理者ロール
-- Supabase Dashboard → SQL Editor で実行
-- 管理者にしたいユーザーは最後の UPDATE 文を編集して実行してください

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_is_admin_idx
  on public.profiles (is_admin)
  where is_admin = true;

-- auth.uid() のユーザーが管理者か判定するヘルパー
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.current_user_is_admin() to anon, authenticated;

-- スレッド: 管理者は誰のものでも削除・更新できる
drop policy if exists "admins can delete any thread" on public.discussion_threads;
create policy "admins can delete any thread"
  on public.discussion_threads for delete
  using (public.current_user_is_admin());

drop policy if exists "admins can update any thread" on public.discussion_threads;
create policy "admins can update any thread"
  on public.discussion_threads for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- コメント: 管理者は削除できる
drop policy if exists "admins can delete any post" on public.discussion_posts;
create policy "admins can delete any post"
  on public.discussion_posts for delete
  using (public.current_user_is_admin());

-- 投票関連も管理者で削除可
drop policy if exists "admins can delete poll options" on public.discussion_poll_options;
create policy "admins can delete poll options"
  on public.discussion_poll_options for delete
  using (public.current_user_is_admin());

drop policy if exists "admins can delete poll votes" on public.discussion_poll_votes;
create policy "admins can delete poll votes"
  on public.discussion_poll_votes for delete
  using (public.current_user_is_admin());

-- 自分を管理者にする（メールアドレスを書き換えて実行）
-- update public.profiles
-- set is_admin = true
-- where id = (
--   select id from auth.users where email = 'you@example.com' limit 1
-- );
