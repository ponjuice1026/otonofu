-- 修正: increment_thread_views_dedup が作成以来まったく成功していなかった問題
--
-- 症状(本番ログ):
--   1) SQLSTATE 42702 column reference "viewer_hash" is ambiguous
--   2) (1修正後に露呈) SQLSTATE 42P10 there is no unique or exclusion constraint
--      matching the ON CONFLICT specification
--
-- 原因:
--   add_thread_view_dedup.sql で thread_view_events.viewer_hash 列を作った後、
--   関数引数 viewer_hash と列 viewer_hash が同名になった。
--   - 既定(#variable_conflict error)では insert ... values (target_id, viewer_hash)
--     の viewer_hash が曖昧で 42702。
--   - #variable_conflict use_variable を付けると値側は解決するが、今度は
--     on conflict (thread_id, viewer_hash, viewed_on) の推論列 viewer_hash まで
--     「変数」と解釈され、索引推論が壊れて 42P10 になる(plpgsql の落とし穴)。
--     ※索引 thread_view_events_unique_idx (thread_id, viewer_hash, viewed_on) は
--       valid/unique/非部分で健全。関数外の生 INSERT では ON CONFLICT は成功する。
--
-- 対応:
--   ON CONFLICT 推論を使わず、unique index 違反(unique_violation)を例外捕捉して
--   重複時は加算しない方式に変更。値側の曖昧さは #variable_conflict use_variable で
--   引数側に解決させる(推論列が無くなったので副作用なし)。
--   シグネチャ・引数名は不変なのでアプリ側(proxy.ts)の呼び出しは変更不要。
-- Supabase Dashboard → SQL Editor で実行。

create or replace function public.increment_thread_views_dedup(
  target_id uuid,
  viewer_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
begin
  if viewer_hash is null or char_length(trim(viewer_hash)) < 8 then
    return;
  end if;

  -- 同一(thread_id, viewer_hash, 当日)は thread_view_events_unique_idx で弾かれる。
  -- ON CONFLICT 推論は #variable_conflict と相性が悪いため使わず、
  -- unique_violation を捕捉して重複時は加算しない。
  begin
    insert into public.thread_view_events (thread_id, viewer_hash)
    values (target_id, viewer_hash);
  exception when unique_violation then
    return;
  end;

  -- 新規挿入できた（=その viewer の当日初回）ときのみ加算
  update public.discussion_threads
  set view_count = view_count + 1
  where id = target_id;

  -- 確率的に古いイベント行を掃除（1/50）。30 日より古い行を削除。
  if random() < 0.02 then
    delete from public.thread_view_events
    where created_at < now() - interval '30 days';
  end if;
end;
$$;

grant execute on function public.increment_thread_views_dedup(uuid, text)
  to anon, authenticated;
