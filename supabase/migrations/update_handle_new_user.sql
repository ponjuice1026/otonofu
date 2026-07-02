-- 新規登録時に user_metadata の display_name をプロフィールに反映する
-- Supabase Dashboard → SQL Editor で実行

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  meta_name text;
  candidate text;
  display text;
begin
  meta_name := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')),
    ''
  );
  base_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'user');
  candidate := base_name || '_' || substring(new.id::text, 1, 8);
  display := coalesce(meta_name, base_name);

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, display)
  on conflict (id) do nothing;

  return new;
end;
$$;
