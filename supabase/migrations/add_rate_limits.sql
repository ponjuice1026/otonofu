-- レート制限・スパム対策（匿名投稿可の 5ch 型設計向け）
-- Supabase Dashboard → SQL Editor で実行
--
-- DB ベースのレート制限。外部サービス不要。
-- key は user_id または voter_key/IP ハッシュ。action ごとに窓内の件数を数える。
-- カウントと挿入を security definer 関数内でアトミックに行う。

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null,
  action text not null,
  created_at timestamptz not null default now()
);

-- (key, action, created_at) の複合インデックスで窓内カウントを高速化
create index if not exists rate_limit_events_key_action_idx
  on public.rate_limit_events (key, action, created_at desc);

-- 古い行の削除（掃除）用インデックス
create index if not exists rate_limit_events_created_at_idx
  on public.rate_limit_events (created_at);

alter table public.rate_limit_events enable row level security;
-- クライアント（anon/authenticated）からの直接 select/insert は一切許可しない。
-- 操作はすべて下の security definer 関数経由。RLS 有効かつポリシー無し = 全拒否。

-- レート制限チェック + イベント記録をアトミックに行う。
-- 窓内の既存件数が max_count 以上なら false を返す（挿入しない）。
-- 上限未満なら 1 行挿入して true を返す。
-- dedup_body が渡された場合、同一 key・同一本文の投稿が dedup_window_seconds 以内に
-- あれば重複とみなし false を返す（挿入しない）。
create or replace function public.check_rate_limit(
  limit_key text,
  limit_action text,
  max_count integer,
  window_seconds integer,
  dedup_body text default null,
  dedup_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  event_count integer;
  window_start timestamptz := now() - make_interval(secs => window_seconds);
  dedup_key text;
begin
  if limit_key is null or limit_key = '' then
    -- key が取れない場合は制限しない（呼び出し側の判断に委ねる）
    return true;
  end if;

  -- 重複投稿防止: 同一 key・同一本文が直近 dedup_window_seconds 以内にあれば拒否
  if dedup_body is not null and dedup_body <> '' then
    dedup_key := limit_action || ':body:' || md5(dedup_body);
    if exists (
      select 1
      from public.rate_limit_events e
      where e.key = limit_key
        and e.action = dedup_key
        and e.created_at > now() - make_interval(secs => dedup_window_seconds)
    ) then
      return false;
    end if;
  end if;

  -- 窓内の件数をカウント
  select count(*)
  into event_count
  from public.rate_limit_events e
  where e.key = limit_key
    and e.action = limit_action
    and e.created_at > window_start;

  if event_count >= max_count then
    return false;
  end if;

  -- 上限未満なので記録
  insert into public.rate_limit_events (key, action) values (limit_key, limit_action);
  if dedup_key is not null then
    insert into public.rate_limit_events (key, action) values (limit_key, dedup_key);
  end if;

  -- 確率的に古い行を掃除（1/50）。1 日より古いイベントを削除。
  if random() < 0.02 then
    delete from public.rate_limit_events
    where created_at < now() - interval '1 day';
  end if;

  return true;
end;
$$;

grant execute on function public.check_rate_limit(text, text, integer, integer, text, integer)
  to anon, authenticated;
