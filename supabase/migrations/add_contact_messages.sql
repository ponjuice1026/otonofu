-- お問い合わせフォーム（/contact）の受信箱。
-- Supabase Dashboard → SQL Editor で実行（何度実行しても安全）
--
-- 挿入は security definer 関数(RPC)経由に限定する。enforce_insert_rpc.sql と
-- 同じ方針で、公開 anon キーによる PostgREST 直叩きでアプリ層の
-- レート制限(lib/rate-limit.ts)とハニーポットを迂回されるのを防ぐ。
-- テーブルへの直接 insert ポリシーは作らない（RLS 有効・insert ポリシー無し）。

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  -- 送信時にログインしていれば紐づける。未ログインなら null
  sender_id uuid references auth.users (id) on delete set null,
  category text not null check (
    category in ('question', 'bug', 'request', 'data', 'report', 'business', 'other')
  ),
  name text not null,
  email text not null,
  body text not null,
  -- 返信済み管理用
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- 管理画面での新着順取得用
create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);

-- 未対応キューの取得用
create index if not exists contact_messages_pending_idx
  on public.contact_messages (created_at desc)
  where handled = false;

alter table public.contact_messages enable row level security;

-- 直接 insert は許可しない。以前のバージョンで作成した permissive な
-- ポリシーが残っていれば削除する。
drop policy if exists "anyone can submit contact messages"
  on public.contact_messages;

-- 読み取りは管理者のみ。送信者本人にも見せない（メール等の再取得を防ぐ）
drop policy if exists "admins can view contact messages"
  on public.contact_messages;
create policy "admins can view contact messages"
  on public.contact_messages for select
  using (public.current_user_is_admin());

-- 対応済みフラグの更新も管理者のみ
drop policy if exists "admins can update contact messages"
  on public.contact_messages;
create policy "admins can update contact messages"
  on public.contact_messages for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- ---------------------------------------------------------------------------
-- 送信 RPC。未ログインでも呼べるが、レート制限（contact: 3/時）を
-- DB 側でも強制する。lib/rate-limit.ts の RATE_LIMITS.contact と揃えること。
-- ---------------------------------------------------------------------------
create or replace function public.submit_contact_message(
  message_category text,
  sender_name text,
  sender_email text,
  message_body text,
  voter_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  limit_key text;
  normalized_name text;
  normalized_email text;
  normalized_body text;
  new_id uuid;
begin
  -- 未ログインの場合は voter_key を必須にする。これが無いと
  -- レート制限のキーが立たず、無制限に送信できてしまう。
  if auth.uid() is null
     and (voter_key is null or char_length(trim(voter_key)) < 16) then
    raise exception 'invalid voter key';
  end if;

  limit_key := public.otonofu_rate_limit_key(voter_key);

  if message_category not in
     ('question', 'bug', 'request', 'data', 'report', 'business', 'other') then
    raise exception 'invalid category';
  end if;

  normalized_name := trim(coalesce(sender_name, ''));
  if char_length(normalized_name) < 1 or char_length(normalized_name) > 100 then
    raise exception 'invalid name';
  end if;

  normalized_email := trim(coalesce(sender_email, ''));
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or char_length(normalized_email) > 254 then
    raise exception 'invalid email';
  end if;

  normalized_body := trim(coalesce(message_body, ''));
  if char_length(normalized_body) < 10 or char_length(normalized_body) > 4000 then
    raise exception 'invalid body';
  end if;

  -- 最低限のモデレーション（URL 数上限）。enforce_insert_rpc.sql と共通。
  perform public.otonofu_assert_content_ok(normalized_body);

  -- レート制限（contact: 3/時）。同一本文の連投も 60 秒間は弾く。
  if not public.check_rate_limit(
    limit_key, 'contact', 3, 3600, normalized_body, 60
  ) then
    raise exception 'rate limit exceeded';
  end if;

  insert into public.contact_messages (sender_id, category, name, email, body)
  values (
    auth.uid(),
    message_category,
    normalized_name,
    normalized_email,
    normalized_body
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function
  public.submit_contact_message(text, text, text, text, text)
  to anon, authenticated;
