-- レビューから自動生成されるセッション
-- Supabase Dashboard → SQL Editor で実行

alter table public.reviews
  add column if not exists session_opt_out boolean not null default false;

alter table public.discussion_threads
  add column if not exists review_id text references public.reviews (id) on delete cascade,
  add column if not exists album_id text references public.albums (id) on delete set null;

create unique index if not exists discussion_threads_review_id_unique
  on public.discussion_threads (review_id)
  where review_id is not null;

create index if not exists discussion_threads_album_id_idx
  on public.discussion_threads (album_id)
  where album_id is not null;

-- 既存レビューをセッション化（session_opt_out = false かつ user_id あり）
insert into public.discussion_threads (
  author_id,
  title,
  body,
  status,
  review_id,
  album_id,
  created_at,
  updated_at
)
select
  r.user_id,
  left(r.album_title || ' のレビュー', 120),
  left(
    trim(
      both E'\n' from
      concat_ws(
        E'\n\n',
        nullif(trim(r.body), ''),
        '総合評価: ' || trim(to_char(r.rating, 'FM999990.0')) || '/10'
      )
    ),
    4000
  ),
  'published',
  r.id,
  r.album_id,
  coalesce(r.updated_at::timestamptz, r.created_at::timestamptz, now()),
  coalesce(r.updated_at::timestamptz, r.created_at::timestamptz, now())
from public.reviews r
where r.user_id is not null
  and r.session_opt_out = false
  and not exists (
    select 1
    from public.discussion_threads t
    where t.review_id = r.id
  );
