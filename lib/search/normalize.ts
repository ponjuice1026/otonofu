// 検索用の文字列正規化。
// ここでの正規化規則は supabase/migrations/add_search_normalization.sql の
// public.otonofu_normalize_search() と **完全に同一** でなければならない。
// 片方だけ規則を変えると DB 側の search_text と TS 側で照合できずヒットしなくなる。
//
// 正規化規則（SQL と共通）:
//   1. Unicode NFKC 正規化（全角英数記号→半角、半角カナ→全角カナ等）
//   2. カタカナ→ひらがな（U+30A1..U+30F6 を -0x60 シフト、ヴ等含む）
//   3. 英字を小文字化
//   4. 長音符「ー」「〜」、中黒「・」、および全空白を除去

// カタカナ（ぁ相当〜ヶ）→ ひらがな変換。
// U+30A1(ァ)〜U+30F6(ヶ) を 0x60 引いてひらがなにする。
// ヷ(30F7)〜ヺ(30FA) と ・ー等はここでは触れない（除去や NFKC 側で処理）。
function katakanaToHiragana(value: string): string {
  let result = "";
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCodePoint(code - 0x60);
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * 検索照合用にテキストを正規化する。
 * SQL 側 otonofu_normalize_search() と同じ結果を返すこと。
 */
export function normalizeSearchText(value: string): string {
  if (!value) return "";
  return katakanaToHiragana(value.normalize("NFKC"))
    .toLowerCase()
    // 長音符・各種ダッシュ・波ダッシュ・中黒・全角/半角スペース類を除去。
    // 文字クラスの範囲(‐-〜 など)誤認を避けるため個別文字を列挙する。
    // 対象: ー(U+30FC) ―(U+2015) ‐(U+2010) -(U+002D) 〜(U+301C) ～(U+FF5E)
    //       ・(U+30FB) ･(U+FF65) および各種空白
    .replace(/[ー―‐〜～・･\s　-]/g, "");
}

export function matchesSearchQuery(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const activeFields = fields.filter(
    (field): field is string => Boolean(field?.trim()),
  );
  if (activeFields.length === 0) return false;

  const qLower = trimmed.toLowerCase();
  const qNorm = normalizeSearchText(trimmed);
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  return activeFields.some((field) => {
    const fLower = field.toLowerCase();
    const fNorm = normalizeSearchText(field);

    if (fLower.includes(qLower) || fNorm.includes(qNorm)) {
      return true;
    }

    if (tokens.length > 1) {
      return tokens.every((token) => {
        const tokenLower = token.toLowerCase();
        const tokenNorm = normalizeSearchText(token);
        return (
          fLower.includes(tokenLower) ||
          fNorm.includes(tokenNorm) ||
          tokenNorm.includes(fNorm)
        );
      });
    }

    return false;
  });
}

export function searchMatchScore(
  query: string,
  ...fields: (string | null | undefined)[]
): number {
  if (!matchesSearchQuery(query, ...fields)) return 0;

  const trimmed = query.trim();
  const qLower = trimmed.toLowerCase();
  const qNorm = normalizeSearchText(trimmed);
  let score = 0;

  for (const field of fields) {
    if (!field) continue;
    const fLower = field.toLowerCase();
    const fNorm = normalizeSearchText(field);

    if (fLower === qLower || fNorm === qNorm) score = Math.max(score, 100);
    else if (fLower.startsWith(qLower) || fNorm.startsWith(qNorm)) {
      score = Math.max(score, 80);
    } else if (fLower.includes(qLower) || fNorm.includes(qNorm)) {
      score = Math.max(score, 60);
    }
  }

  return score;
}
