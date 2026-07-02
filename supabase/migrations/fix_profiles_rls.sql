-- プロフィール作成ポリシーと既存ユーザーのバックフィル
-- Supabase Dashboard → SQL Editor で実行（何度実行しても OK）

drop policy if exists "users can insert own profile" on public.profiles;

create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

insert into public.profiles (id, username, display_name)
select
  u.id,
  coalesce(nullif(split_part(u.email, '@', 1), ''), 'user')
    || '_'
    || substring(u.id::text, 1, 8),
  coalesce(nullif(split_part(u.email, '@', 1), ''), 'user')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
