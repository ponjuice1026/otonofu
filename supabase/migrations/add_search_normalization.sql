-- 日本語検索の改善: 正規化列 + pg_trgm
-- Supabase Dashboard → SQL Editor で実行する。
--
-- 目的:
--   - ひらがな⇔カタカナ、全角⇔半角の表記ゆれを吸収する
--   - 「ゆらゆらていこく」で「ゆらゆら帝国」がヒットするようにする
--   - 中間一致 ilike のみだったのを trigram インデックス + 類似度順にする
--
-- 正規化規則（lib/search/normalize.ts の normalizeSearchText と **完全一致** させること）:
--   1. NFKC 正規化（全角英数記号→半角、半角カナ→全角カナ 等）
--   2. カタカナ→ひらがな（U+30A1..U+30F6 を -0x60 シフト）
--   3. 英字を小文字化
--   4. 長音「ー」「―」「‐」「-」、波ダッシュ「〜」「～」、中黒「・」「･」、空白（半角/全角）を除去

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- 正規化関数（TS 側 normalizeSearchText と同一の変換規則）
-- ---------------------------------------------------------------------------
create or replace function public.otonofu_normalize_search(input text)
returns text
language sql
immutable
strict
as $$
  select
    regexp_replace(
      lower(
        translate(
          -- 1. NFKC 正規化
          normalize(coalesce(input, ''), NFKC),
          -- 2. カタカナ(U+30A1..U+30F6) → ひらがな(-0x60)
          'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ',
          'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ'
        )
      ),
      -- 4. 長音・波ダッシュ・中黒・空白（半角/全角）を除去
      '[ー―‐\-〜～・･[:space:]　]',
      '',
      'g'
    );
$$;

-- ---------------------------------------------------------------------------
-- 正規化列と GIN(trgm) インデックス
-- ---------------------------------------------------------------------------
alter table public.artists add column if not exists search_text text;
alter table public.albums  add column if not exists search_text text;

-- artists: name + name_en を正規化して連結
create or replace function public.otonofu_artists_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text :=
    public.otonofu_normalize_search(coalesce(new.name, '')) || ' ' ||
    public.otonofu_normalize_search(coalesce(new.name_en, ''));
  return new;
end;
$$;

drop trigger if exists artists_search_text_trg on public.artists;
create trigger artists_search_text_trg
  before insert or update of name, name_en on public.artists
  for each row execute function public.otonofu_artists_search_text();

-- albums: title のみ（アーティスト名はアーティスト側 search_text で拾う）
create or replace function public.otonofu_albums_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := public.otonofu_normalize_search(coalesce(new.title, ''));
  return new;
end;
$$;

drop trigger if exists albums_search_text_trg on public.albums;
create trigger albums_search_text_trg
  before insert or update of title on public.albums
  for each row execute function public.otonofu_albums_search_text();

create index if not exists artists_search_text_trgm_idx
  on public.artists using gin (search_text gin_trgm_ops);
create index if not exists albums_search_text_trgm_idx
  on public.albums using gin (search_text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 既存データの backfill（トリガーを通さず直接更新）
-- ---------------------------------------------------------------------------
update public.artists set search_text =
  public.otonofu_normalize_search(coalesce(name, '')) || ' ' ||
  public.otonofu_normalize_search(coalesce(name_en, ''));

update public.albums set search_text =
  public.otonofu_normalize_search(coalesce(title, ''));

-- ---------------------------------------------------------------------------
-- 検索 RPC（正規化クエリで ilike フィルタ + similarity 降順で並べる）
-- PostgREST では関数式での order ができないため RPC 経由で行う。
-- 戻り値は SECURITY INVOKER（デフォルト）なので RLS がそのまま効く。
-- ---------------------------------------------------------------------------
create or replace function public.search_artists(q text, result_limit integer default 20)
returns table (
  id text,
  name text,
  name_en text,
  spotify_id text,
  image_url text,
  score real
)
language sql
stable
as $$
  with norm as (
    select public.otonofu_normalize_search(q) as nq
  )
  select
    a.id, a.name, a.name_en, a.spotify_id, a.image_url,
    similarity(a.search_text, norm.nq) as score
  from public.artists a, norm
  where norm.nq <> ''
    and a.search_text ilike '%' || norm.nq || '%'
  order by score desc, a.name asc
  limit greatest(1, least(coalesce(result_limit, 20), 50));
$$;

create or replace function public.search_albums(q text, result_limit integer default 20)
returns table (
  id text,
  title text,
  artist_id text,
  year integer,
  cover_url text,
  spotify_id text,
  score real
)
language sql
stable
as $$
  with norm as (
    select public.otonofu_normalize_search(q) as nq
  )
  select
    al.id, al.title, al.artist_id, al.year, al.cover_url, al.spotify_id,
    similarity(al.search_text, norm.nq) as score
  from public.albums al, norm
  where norm.nq <> ''
    and al.search_text ilike '%' || norm.nq || '%'
  order by score desc, al.year desc
  limit greatest(1, least(coalesce(result_limit, 20), 50));
$$;

grant execute on function public.otonofu_normalize_search(text) to anon, authenticated;
grant execute on function public.search_artists(text, integer) to anon, authenticated;
grant execute on function public.search_albums(text, integer) to anon, authenticated;
