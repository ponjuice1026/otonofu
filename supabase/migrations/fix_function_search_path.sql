-- 対応: Security Advisor 警告 "Function Search Path Mutable"
--
-- 対象: search_path を固定していなかった public の関数。
--   実測で SECURITY DEFINER 関数は全て設定済みだった（最重要カテゴリは対応不要）。
--   残っていたのは language sql の読み取り関数 2 つのみ:
--     - ranked_albums_bayesian
--     - ranked_albums_by_period
--   どちらも public.* を完全修飾し、拡張/auth 非依存のため固定は無害。
--
-- 対応: search_path を public, pg_temp に固定（挙動不変。適用後に
--   両関数を呼び出して各10件返ることを確認済み）。
-- Supabase Dashboard → SQL Editor で実行。本番には適用済み。

alter function public.ranked_albums_bayesian(numeric, integer, text)
  set search_path = public, pg_temp;

alter function public.ranked_albums_by_period(timestamptz, numeric, integer, text)
  set search_path = public, pg_temp;
