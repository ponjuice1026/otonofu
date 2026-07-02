const TITLE_MAX = 120;
const THREAD_BODY_MAX = 4000;
const POST_BODY_MAX = 4000;
const NAME_MAX = 24;
const POLL_OPTION_MAX = 80;
const POLL_OPTION_MIN = 2;
const POLL_OPTION_MAX_COUNT = 8;

export function normalizeTitle(value: string): string {
  return value.trim().slice(0, TITLE_MAX);
}

export function normalizeThreadBody(value: string): string {
  return value.trim().slice(0, THREAD_BODY_MAX);
}

export function normalizePostBody(value: string): string {
  return value.trim().slice(0, POST_BODY_MAX);
}

export function normalizeAnonymousName(value: string): string {
  const trimmed = value.trim().slice(0, NAME_MAX);
  if (trimmed.length > 0) return trimmed;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `名無し${suffix}`;
}

export function profilePostName(
  displayName: string | null | undefined,
  username: string,
): string {
  const label = displayName?.trim() || username.trim();
  if (!label) return "ユーザー".slice(0, NAME_MAX);
  return label.slice(0, NAME_MAX);
}

export function normalizeDraftTitle(value: string): string {
  const title = normalizeTitle(value);
  return title || "（無題）";
}

export function validateTitle(value: string): string | null {
  const title = normalizeTitle(value);
  if (!title) return "タイトルを入力してください。";
  return null;
}

export function validateThreadBody(value: string): string | null {
  const body = normalizeThreadBody(value);
  if (!body) return "セッションの説明を入力してください。";
  return null;
}

export function validatePostBody(value: string): string | null {
  const body = normalizePostBody(value);
  if (!body) return "コメントを入力してください。";
  return null;
}

export function normalizePollOptionLabel(value: string): string {
  return value.trim().slice(0, POLL_OPTION_MAX);
}

export type PollOptionInput = {
  type: "text" | "album" | "artist";
  label: string;
  albumId?: string;
  artistId?: string;
  excludeFromTally?: boolean;
};

export function parsePollOptionsFromFormData(
  formData: FormData,
): PollOptionInput[] {
  const raw = String(formData.get("pollOptionsJson") ?? "").trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const seenKeys = new Set<string>();
  const result: PollOptionInput[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const rawType = typeof obj.type === "string" ? obj.type : "text";
    const type: PollOptionInput["type"] =
      rawType === "album" || rawType === "artist" ? rawType : "text";

    const label = normalizePollOptionLabel(
      typeof obj.label === "string" ? obj.label : "",
    );
    if (!label) continue;

    const albumId =
      type === "album" && typeof obj.albumId === "string" && obj.albumId
        ? obj.albumId
        : undefined;
    const artistId =
      type === "artist" && typeof obj.artistId === "string" && obj.artistId
        ? obj.artistId
        : undefined;

    if (type === "album" && !albumId) continue;
    if (type === "artist" && !artistId) continue;

    const dedupeKey =
      type === "album"
        ? `album:${albumId}`
        : type === "artist"
          ? `artist:${artistId}`
          : `text:${label.toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    result.push({ type, label, albumId, artistId, excludeFromTally: false });
  }

  return result;
}

export function validatePollOptions(options: PollOptionInput[]): string | null {
  if (options.length < POLL_OPTION_MIN) {
    return `選択肢は${POLL_OPTION_MIN}つ以上入力してください。`;
  }
  if (options.length > POLL_OPTION_MAX_COUNT) {
    return `選択肢は${POLL_OPTION_MAX_COUNT}つまでです。`;
  }
  return null;
}

export function validatePollOptionAdd(options: PollOptionInput[]): string | null {
  if (options.length !== 1) {
    return "追加する選択肢を1つ指定してください。";
  }
  if (!options[0].label) {
    return "選択肢を入力してください。";
  }
  return null;
}

export { POLL_OPTION_MAX_COUNT };
