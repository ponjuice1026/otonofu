/**
 * ジャンルの固定タクソノミー(RYM式の簡易版)。
 *
 * 背景: `albums.genre` は単一文字列、`artists.genres` は Spotify 由来の文字列配列で、
 * 正規化されたジャンル体系が存在しない。本格的なジャンル階層DBは過剰なので、
 * ここでは「正規化した固定リスト + aliases によるマッチング」で始める。
 *
 * 各ジャンルの `aliases` には、既存データ(Spotifyジャンル名など)にありがちな
 * 表記を小文字で列挙する。マッチングは `matchGenreSlugs()` 参照。
 *
 * TODO(将来): 本格化する場合は以下へ移行する。
 *   - `genres` テーブル(id, slug, name, parent_id で階層化)
 *   - `album_genres` 中間テーブル(album_id, genre_id, votes)
 *   - ユーザー投票制でアルバムごとのジャンルを決める(RYM式)
 * その際は本ファイルの固定リストはシード/フォールバックとして残せる。
 */

export type Genre = {
  slug: string;
  name: string;
  nameEn: string;
  /** マッチング用の別名(小文字)。Spotifyジャンル名や表記ゆれを列挙 */
  aliases: string[];
};

export const GENRES: Genre[] = [
  {
    slug: "j-pop",
    name: "J-Pop",
    nameEn: "J-Pop",
    aliases: ["j-pop", "jpop", "japanese pop", "j pop"],
  },
  {
    slug: "j-rock",
    name: "J-Rock",
    nameEn: "J-Rock",
    aliases: ["j-rock", "jrock", "japanese rock", "japanese alternative rock", "j pop rock"],
  },
  {
    slug: "city-pop",
    name: "シティポップ",
    nameEn: "City Pop",
    aliases: ["city pop", "citypop", "シティ・ポップ", "シティポップ", "japanese city pop"],
  },
  {
    slug: "kayokyoku",
    name: "歌謡曲",
    nameEn: "Kayokyoku",
    aliases: ["kayokyoku", "kayo kyoku", "歌謡曲", "showa kayo", "japanese oldies"],
  },
  {
    slug: "enka",
    name: "演歌",
    nameEn: "Enka",
    aliases: ["enka", "演歌", "japanese enka"],
  },
  {
    slug: "idol",
    name: "アイドル",
    nameEn: "Idol",
    aliases: ["idol", "j-idol", "japanese idol", "アイドル", "idol pop"],
  },
  {
    slug: "visual-kei",
    name: "V系",
    nameEn: "Visual Kei",
    aliases: ["visual kei", "visual-kei", "v系", "ヴィジュアル系", "vkei"],
  },
  {
    slug: "anison",
    name: "アニソン",
    nameEn: "Anison",
    aliases: ["anison", "anime", "anime score", "anime rock", "アニソン", "アニメ", "otacore"],
  },
  {
    slug: "vocaloid",
    name: "ボカロ",
    nameEn: "Vocaloid",
    aliases: ["vocaloid", "ボカロ", "ボーカロイド", "utaite"],
  },
  {
    slug: "shibuya-kei",
    name: "渋谷系",
    nameEn: "Shibuya-kei",
    aliases: ["shibuya-kei", "shibuya kei", "渋谷系"],
  },
  {
    slug: "game-music",
    name: "ゲーム音楽",
    nameEn: "Game Music",
    aliases: ["video game music", "game music", "vgm", "chiptune", "ゲーム音楽", "ゲーム"],
  },
  {
    slug: "hip-hop",
    name: "HIP HOP",
    nameEn: "Hip Hop",
    aliases: ["hip hop", "hip-hop", "rap", "j-rap", "japanese hip hop", "ヒップホップ", "ラップ", "trap"],
  },
  {
    slug: "rnb",
    name: "R&B",
    nameEn: "R&B",
    aliases: ["r&b", "rnb", "r n b", "contemporary r&b", "japanese r&b", "アールアンドビー"],
  },
  {
    slug: "soul",
    name: "ソウル",
    nameEn: "Soul",
    aliases: ["soul", "neo soul", "ソウル", "northern soul"],
  },
  {
    slug: "funk",
    name: "ファンク",
    nameEn: "Funk",
    aliases: ["funk", "ファンク", "p funk", "funk rock"],
  },
  {
    slug: "electronic",
    name: "エレクトロニック",
    nameEn: "Electronic",
    aliases: ["electronic", "electronica", "electro", "エレクトロニカ", "エレクトロ", "idm", "edm"],
  },
  {
    slug: "techno",
    name: "テクノ",
    nameEn: "Techno",
    aliases: ["techno", "テクノ", "detroit techno", "minimal techno"],
  },
  {
    slug: "house",
    name: "ハウス",
    nameEn: "House",
    aliases: ["house", "ハウス", "deep house", "tech house", "acid house"],
  },
  {
    slug: "ambient",
    name: "アンビエント",
    nameEn: "Ambient",
    aliases: ["ambient", "アンビエント", "dark ambient", "drone", "environmental"],
  },
  {
    slug: "jazz",
    name: "ジャズ",
    nameEn: "Jazz",
    aliases: ["jazz", "bebop", "swing", "hard bop", "cool jazz", "free jazz", "ジャズ", "japanese jazz"],
  },
  {
    slug: "fusion",
    name: "フュージョン",
    nameEn: "Fusion",
    aliases: ["fusion", "jazz fusion", "フュージョン", "jazz funk"],
  },
  {
    slug: "post-rock",
    name: "ポストロック",
    nameEn: "Post-Rock",
    aliases: ["post-rock", "post rock", "ポストロック", "math rock", "マスロック"],
  },
  {
    slug: "shoegaze",
    name: "シューゲイザー",
    nameEn: "Shoegaze",
    aliases: ["shoegaze", "シューゲイザー", "シューゲイズ", "dream pop", "ドリームポップ"],
  },
  {
    slug: "punk",
    name: "パンク",
    nameEn: "Punk",
    aliases: ["punk", "punk rock", "パンク", "pop punk", "post-punk", "ポストパンク"],
  },
  {
    slug: "hardcore",
    name: "ハードコア",
    nameEn: "Hardcore",
    aliases: ["hardcore", "hardcore punk", "ハードコア", "post-hardcore", "metalcore"],
  },
  {
    slug: "metal",
    name: "メタル",
    nameEn: "Metal",
    aliases: ["metal", "heavy metal", "death metal", "black metal", "thrash metal", "メタル", "ヘヴィメタル", "djent"],
  },
  {
    slug: "rock",
    name: "ロック",
    nameEn: "Rock",
    aliases: ["rock", "alternative rock", "indie rock", "classic rock", "hard rock", "ロック", "オルタナ", "オルタナティブ"],
  },
  {
    slug: "pop",
    name: "ポップ",
    nameEn: "Pop",
    aliases: ["pop", "pop rock", "art pop", "synth pop", "ポップ", "シンセポップ", "インディーポップ", "indie pop"],
  },
  {
    slug: "folk",
    name: "フォーク",
    nameEn: "Folk",
    aliases: ["folk", "folk rock", "acoustic", "フォーク", "japanese folk", "traditional folk"],
  },
  {
    slug: "singer-songwriter",
    name: "SSW",
    nameEn: "Singer-Songwriter",
    aliases: ["singer-songwriter", "singer songwriter", "ssw", "シンガーソングライター"],
  },
  {
    slug: "classical",
    name: "クラシック",
    nameEn: "Classical",
    aliases: ["classical", "opera", "orchestral", "symphony", "baroque", "chamber music", "クラシック", "現代音楽"],
  },
  {
    slug: "experimental",
    name: "実験音楽",
    nameEn: "Experimental",
    aliases: ["experimental", "avant-garde", "avant garde", "実験音楽", "アヴァンギャルド", "musique concrete"],
  },
  {
    slug: "noise",
    name: "ノイズ",
    nameEn: "Noise",
    aliases: ["noise", "noise rock", "harsh noise", "ノイズ", "japanoise"],
  },
  {
    slug: "reggae",
    name: "レゲエ",
    nameEn: "Reggae",
    aliases: ["reggae", "dub", "ska", "dancehall", "レゲエ", "ダブ", "スカ"],
  },
  {
    slug: "blues",
    name: "ブルース",
    nameEn: "Blues",
    aliases: ["blues", "blues rock", "rhythm and blues", "ブルース"],
  },
  {
    slug: "country",
    name: "カントリー",
    nameEn: "Country",
    aliases: ["country", "americana", "bluegrass", "カントリー"],
  },
  {
    slug: "disco",
    name: "ディスコ",
    nameEn: "Disco",
    aliases: ["disco", "nu-disco", "boogie", "ディスコ"],
  },
  {
    slug: "soundtrack",
    name: "サウンドトラック",
    nameEn: "Soundtrack",
    aliases: ["soundtrack", "score", "film score", "サウンドトラック", "劇伴", "ost"],
  },
];

const GENRE_BY_SLUG = new Map(GENRES.map((g) => [g.slug, g]));

export function getGenreBySlug(slug: string): Genre | undefined {
  return GENRE_BY_SLUG.get(slug);
}

/**
 * 与えられたジャンル文字列(album.genre や artist.genres の各要素、origin など)を
 * 1つの blob にまとめ、どの固定ジャンルにマッチするかの slug 集合を返す。
 *
 * マッチングは aliases の部分一致(小文字・両端の単語境界をゆるく判定)で行う。
 * マッチしなければ空集合を返す(呼び出し側は非リンク表示にフォールバックできる)。
 */
export function matchGenreSlugs(values: (string | null | undefined)[]): Set<string> {
  const blob = values
    .filter((v): v is string => Boolean(v))
    .join(" | ")
    .toLowerCase();

  const matched = new Set<string>();
  if (!blob) return matched;

  for (const genre of GENRES) {
    for (const alias of genre.aliases) {
      if (blob.includes(alias.toLowerCase())) {
        matched.add(genre.slug);
        break;
      }
    }
  }
  return matched;
}

/**
 * 単一のジャンル文字列(album.genre など)にマッチする最初の Genre を返す。
 * アルバム/アーティスト詳細のジャンル表記をリンク化する用途。
 * マッチしなければ undefined(非リンク表示にフォールバック)。
 */
export function findGenreForLabel(label: string | null | undefined): Genre | undefined {
  if (!label) return undefined;
  const lower = label.toLowerCase();
  for (const genre of GENRES) {
    // 名称そのものの一致も許容(表示ラベルが日本語名/英語名のことがある)
    if (
      genre.name.toLowerCase() === lower ||
      genre.nameEn.toLowerCase() === lower
    ) {
      return genre;
    }
    for (const alias of genre.aliases) {
      if (lower.includes(alias.toLowerCase())) {
        return genre;
      }
    }
  }
  return undefined;
}
