-- アルバム評価を5項目（歌詞・メロディ・演奏技術・雰囲気・完成度）に拡張
-- rating 列は5項目の平均（小数1桁）を保存
-- Supabase Dashboard → SQL Editor で実行

alter table public.reviews
  add column if not exists rating_lyrics numeric(2, 1)
    check (rating_lyrics is null or (rating_lyrics >= 1 and rating_lyrics <= 5)),
  add column if not exists rating_melody numeric(2, 1)
    check (rating_melody is null or (rating_melody >= 1 and rating_melody <= 5)),
  add column if not exists rating_performance numeric(2, 1)
    check (rating_performance is null or (rating_performance >= 1 and rating_performance <= 5)),
  add column if not exists rating_atmosphere numeric(2, 1)
    check (rating_atmosphere is null or (rating_atmosphere >= 1 and rating_atmosphere <= 5)),
  add column if not exists rating_completion numeric(2, 1)
    check (rating_completion is null or (rating_completion >= 1 and rating_completion <= 5));

-- 既存レビュー: 総合 rating を各項目にコピー（編集時に再評価可能）
update public.reviews
set
  rating_lyrics = rating,
  rating_melody = rating,
  rating_performance = rating,
  rating_atmosphere = rating,
  rating_completion = rating
where user_id is not null
  and rating_lyrics is null;
