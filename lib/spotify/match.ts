/**
 * DB の albums 行と Spotify 検索候補を突き合わせるための純粋なスコアリング関数群。
 *
 * scripts/match-spotify.ts から呼ばれる。誤マッチ（別アルバムのジャケットが
 * 付いてしまう事故）を避けることを最優先にしているため、アーティスト名が
 * 一致しない候補は問答無用でスコア 0（採用不可）にする。
 *
 * 正規化は scripts/import-missing-albums.ts の norm()/titleScore() と同じ
 * 考え方（NFKC + 小文字化 + 記号除去）をベースに、feat./カッコ内の付随情報
 * （Remastered, Deluxe Edition 等）の揺れも吸収できるよう少し強化している。
 */

export type MatchAlbumRow = {
  id: string;
  title: string;
  /** DB 側のアーティスト表記。artists.name */
  artistName: string;
  /** DB 側のアーティスト表記（英語表記があれば）。artists.name_en */
  artistNameEn?: string | null;
  /** albums.year */
  year: number | null;
};

export type MatchCandidate = {
  id: string;
  name: string;
  /** Spotify album の release_date（YYYY-MM-DD or YYYY 等） */
  releaseDate?: string | null;
  artists: { id: string; name: string }[];
  images?: { url: string }[];
};

export type MatchScoreDetail = {
  /** 0〜1 の合成スコア。artistOk が false の場合は必ず 0 */
  score: number;
  titleScore: number;
  yearScore: number;
  artistOk: boolean;
  /** 年情報が片方または両方欠けているため yearScore を評価不能として中立扱いにしたか */
  yearUnknown: boolean;
};

export type MatchResult = {
  candidate: MatchCandidate;
  detail: MatchScoreDetail;
};

// ── 正規化 ─────────────────────────────────────────────

/**
 * タイトル/アーティスト名の表記揺れ吸収用正規化。
 * NFKC（全角→半角、互換文字統一）→ 小文字化 → 空白・記号・中黒・長音類の除去。
 * import-missing-albums.ts の norm() と互換の考え方。
 */
export function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(
      /[\s　・.,'"’”“`~〜!?！？&＆()（）\[\]「」『』/／\-–—:：;；]/g,
      "",
    );
}

/**
 * タイトル比較用の正規化。normalizeText に加えて、
 * "feat.", "featuring", "with ..." 等の付随情報や
 * "(Remastered 2011)" "- Deluxe Edition" のような注記を除去してから比較する。
 * これにより「同一アルバムの別エディション」を過度に別物扱いしないが、
 * タイトル本体が異なる場合はスコアに反映される。
 */
export function normalizeTitleForCompare(s: string | null | undefined): string {
  if (!s) return "";
  const stripped = s
    // 丸括弧/角括弧内の注記（Remastered, Deluxe Edition, Live 等）を除去
    .replace(/[（(][^）)]*(remaster|deluxe|edition|anniversary|version|bonus|live|explicit|expanded)[^）)]*[）)]/gi, "")
    // feat./featuring 以降を除去
    .replace(/\s*(feat\.?|featuring|with)\s+.+$/gi, "");
  return normalizeText(stripped);
}

// ── タイトル類似度 ─────────────────────────────────────

/**
 * 文字 bigram の Dice 係数（0〜1）。短い文字列同士の緩い類似度判定に使う。
 */
function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) {
    return a === b ? 1 : 0;
  }

  const bigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i += 1) {
      const g = s.slice(i, i + 2);
      map.set(g, (map.get(g) ?? 0) + 1);
    }
    return map;
  };

  const mapA = bigrams(a);
  const mapB = bigrams(b);
  let intersection = 0;
  for (const [g, countA] of mapA) {
    const countB = mapB.get(g);
    if (countB) intersection += Math.min(countA, countB);
  }
  const totalA = [...mapA.values()].reduce((s, v) => s + v, 0);
  const totalB = [...mapB.values()].reduce((s, v) => s + v, 0);
  if (totalA + totalB === 0) return 0;
  return (2 * intersection) / (totalA + totalB);
}

/**
 * タイトル類似度を 0〜1 で返す。
 * 完全一致=1.0 / 前方一致(接頭辞、短すぎる一致は誤検出しやすいので長さ制限あり)=0.85
 * / 包含関係=0.7 / それ以外はbigram類似度（連続値）。
 */
export function titleSimilarity(dbTitle: string, candidateTitle: string): number {
  const d = normalizeTitleForCompare(dbTitle);
  const t = normalizeTitleForCompare(candidateTitle);
  if (!d || !t) return 0;
  if (d === t) return 1;

  const minLenForPrefix = 4;
  if (d.length >= minLenForPrefix && t.length >= minLenForPrefix) {
    if (d.startsWith(t) || t.startsWith(d)) return 0.85;
    if (d.includes(t) || t.includes(d)) return 0.7;
  }

  return bigramSimilarity(d, t);
}

// ── アーティスト一致判定 ────────────────────────────────

/**
 * DB 側アーティスト名（name / name_en）のいずれかが、Spotify 候補の
 * artists[] のいずれかと正規化後に「完全一致」または「一方が他方を包含」する場合に true。
 * 誤マッチ防止の要なので、緩い bigram 類似度ではなく厳格な一致判定にする。
 */
export function artistMatches(
  dbArtistNames: (string | null | undefined)[],
  candidateArtists: { name: string }[],
): boolean {
  const dbNames = dbArtistNames
    .map((n) => normalizeText(n))
    .filter((n) => n.length > 0);
  if (dbNames.length === 0) return false;

  const candNames = candidateArtists
    .map((a) => normalizeText(a.name))
    .filter((n) => n.length > 0);
  if (candNames.length === 0) return false;

  return dbNames.some((dbName) =>
    candNames.some((candName) => {
      if (dbName === candName) return true;
      // 短すぎる名前同士の部分一致は誤爆しやすいので最低文字数を要求
      const minLen = 2;
      if (dbName.length < minLen || candName.length < minLen) return false;
      return dbName.includes(candName) || candName.includes(dbName);
    }),
  );
}

// ── 年の近さ ───────────────────────────────────────────

function extractYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

/**
 * 年の近さスコア。差0=1.0 / 差1=0.7 / 差2=0.4 / 差3=0.1 / 差4以上=マイナス（減点）。
 * リマスター/再発盤で release_date が新しくなるケースがあるため即除外はしないが、
 * 大きくずれる場合は合成スコアを大きく下げて他の条件が弱ければ不採用になるようにする。
 */
export function yearProximityScore(
  dbYear: number | null,
  candidateReleaseDate: string | null | undefined,
): { score: number; unknown: boolean } {
  const candYear = extractYear(candidateReleaseDate);
  if (dbYear == null || candYear == null) {
    return { score: 0, unknown: true };
  }
  const diff = Math.abs(dbYear - candYear);
  if (diff === 0) return { score: 1, unknown: false };
  if (diff === 1) return { score: 0.7, unknown: false };
  if (diff === 2) return { score: 0.4, unknown: false };
  if (diff === 3) return { score: 0.1, unknown: false };
  return { score: -0.5, unknown: false };
}

// ── 合成スコア ─────────────────────────────────────────

export const SCORE_WEIGHTS = {
  title: 0.65,
  year: 0.35,
} as const;

/** 既定の高信頼閾値。保守的に高めに設定（取りこぼしても誤爆しない方を優先） */
export const DEFAULT_MIN_SCORE = 0.82;
/** これ未満はタイトル類似度が低すぎるとして年やアーティストに関わらず即不採用 */
export const MIN_TITLE_SIMILARITY = 0.55;

/**
 * DB のアルバム行と Spotify 候補 1 件を比較してスコアを算出する。
 * アーティスト不一致 or タイトル類似度が低すぎる場合は score=0（採用不可）。
 * 年情報が片方でも欠けている場合は yearScore を中立(0.5)扱いにして
 * タイトル/アーティストの一致度のみで判断する（年なしでも高信頼になり得るが、
 * その分タイトル一致の要求は緩めない）。
 */
export function scoreCandidate(
  album: MatchAlbumRow,
  candidate: MatchCandidate,
): MatchScoreDetail {
  const artistOk = artistMatches(
    [album.artistName, album.artistNameEn],
    candidate.artists,
  );

  const tScore = titleSimilarity(album.title, candidate.name);

  if (!artistOk || tScore < MIN_TITLE_SIMILARITY) {
    return {
      score: 0,
      titleScore: tScore,
      yearScore: 0,
      artistOk,
      yearUnknown: album.year == null,
    };
  }

  const { score: yScoreRaw, unknown: yearUnknown } = yearProximityScore(
    album.year,
    candidate.releaseDate,
  );
  // 年不明時は中立値（過度な減点も加点もしない）
  const yScore = yearUnknown ? 0.5 : yScoreRaw;

  const composite =
    SCORE_WEIGHTS.title * tScore + SCORE_WEIGHTS.year * yScore;

  // 0〜1 にクランプ（年の大幅なずれによるマイナスで負値になり得るため）
  const clamped = Math.max(0, Math.min(1, composite));

  return {
    score: clamped,
    titleScore: tScore,
    yearScore: yScore,
    artistOk,
    yearUnknown,
  };
}

/**
 * 複数候補の中から最良の 1 件を選ぶ。スコア 0 のものは除外。
 * 同点の場合は年情報が既知の候補を優先する。
 */
export function pickBestMatch(
  album: MatchAlbumRow,
  candidates: MatchCandidate[],
): MatchResult | null {
  const scored = candidates
    .map((candidate) => ({ candidate, detail: scoreCandidate(album, candidate) }))
    .filter((r) => r.detail.score > 0)
    .sort((a, b) => {
      if (b.detail.score !== a.detail.score) return b.detail.score - a.detail.score;
      return Number(a.detail.yearUnknown) - Number(b.detail.yearUnknown);
    });

  return scored[0] ?? null;
}

export function isHighConfidence(score: number, minScore: number): boolean {
  return score >= minScore;
}
