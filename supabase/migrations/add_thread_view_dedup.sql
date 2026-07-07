-- view_count 水増し対策（A-3）
-- Supabase Dashboard → SQL Editor で実行
--
-- 背景（脆弱性）:
--   increment_thread_views(target_id) は anon で無制限に実行でき、
--   人気順・Hot スコアを自由に操作できた。重複排除はクライアント制御の
--   cookie のみで、cookie を送らなければ何度でも加算できた。
--
-- 対策:
--   閲覧イベントを (thread_id, viewer_hash, viewed_on) の一意制約付きで記録し、
--   同一 viewer・同一日・同一スレの再閲覧では加算しない
--   （on conflict do nothing の挿入結果で判定）。viewer_hash は proxy.ts 側で
--   voter cookie（無ければ IP）+ salt から sha256 で生成する（サーバ制御）。
--   旧 increment_thread_views は互換のため残すが anon/authenticated から
--   実行権限を revoke する。

create table if not exists public.thread_view_events (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.discussion_threads (id) on delete cascade,
  viewer_hash text not null,
  viewed_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

-- 同一 viewer・同一日・同一スレを一意にし、重複加算を DB 側で防ぐ
create unique index if not exists thread_view_events_unique_idx
  on public.thread_view_events (thread_id, viewer_hash, viewed_on);

-- 掃除用（created_at で古い行を削除）
create index if not exists thread_view_events_created_at_idx
  on public.thread_view_events (created_at);

alter table public.thread_view_events enable row level security;
-- クライアントからの直接 select/insert は許可しない。操作は下の RPC 経由のみ。
-- RLS 有効かつポリシー無し = 全拒否。

-- viewer_hash 付きの重複排除つき閲覧カウント。
-- 同一(thread_id, viewer_hash, 当日)が既にあれば加算しない。
create or replace function public.increment_thread_views_dedup(
  target_id uuid,
  viewer_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id bigint;
begin
  if viewer_hash is null or char_length(trim(viewer_hash)) < 8 then
    return;
  end if;

  insert into public.thread_view_events (thread_id, viewer_hash)
  values (target_id, viewer_hash)
  on conflict (thread_id, viewer_hash, viewed_on) do nothing
  returning id into inserted_id;

  -- 実際に新規挿入できた（=その viewer の当日初回）ときのみ加算
  if inserted_id is not null then
    update public.discussion_threads
    set view_count = view_count + 1
    where id = target_id;
  end if;

  -- 確率的に古いイベント行を掃除（1/50）。30 日より古い行を削除。
  if random() < 0.02 then
    delete from public.thread_view_events
    where created_at < now() - interval '30 days';
  end if;
end;
$$;

grant execute on function public.increment_thread_views_dedup(uuid, text)
  to anon, authenticated;

-- 旧関数は互換のため残すが、クライアントからの無制限実行を止める。
revoke execute on function public.increment_thread_views(uuid)
  from anon, authenticated;
