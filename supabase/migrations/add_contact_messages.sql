-- お問い合わせフォーム（/contact）の受信箱。
-- 未ログインでも送信できる必要があるため anon にも insert を許可し、
-- 読み取りは管理者のみに限定する（RLS）。
-- Supabase Dashboard → SQL Editor で実行

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

-- 誰でも送信可（未ログインを含む）。sender_id を詐称できないよう、
-- null（匿名）か自分自身の uid のみ許可する。
drop policy if exists "anyone can submit contact messages"
  on public.contact_messages;
create policy "anyone can submit contact messages"
  on public.contact_messages for insert
  with check (sender_id is null or sender_id = auth.uid());

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
