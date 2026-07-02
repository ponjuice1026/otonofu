const USERNAME_MIN = 3;
const USERNAME_MAX = 24;
const DISPLAY_NAME_MAX = 24;
const BIO_MAX = 400;
const USERNAME_RE = /^[A-Za-z0-9_-]+$/;

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, DISPLAY_NAME_MAX);
}

export function normalizeUsername(value: string): string {
  return value.trim().slice(0, USERNAME_MAX);
}

export function normalizeBio(value: string): string {
  return value.replace(/\r\n/g, "\n").trim().slice(0, BIO_MAX);
}

export function validateBio(value: string): string | null {
  const bio = normalizeBio(value);
  if (bio.length > BIO_MAX) {
    return `自己紹介は${BIO_MAX}文字以内にしてください。`;
  }
  return null;
}

export const BIO_MAX_LENGTH = BIO_MAX;

export function validateDisplayName(value: string): string | null {
  const name = normalizeDisplayName(value);
  if (!name) return "表示名を入力してください。";
  if (name.length > DISPLAY_NAME_MAX) {
    return `表示名は${DISPLAY_NAME_MAX}文字以内にしてください。`;
  }
  return null;
}

export function validateUsername(value: string): string | null {
  const name = normalizeUsername(value);
  if (!name) return "ユーザー名を入力してください。";
  if (name.length < USERNAME_MIN) {
    return `ユーザー名は${USERNAME_MIN}文字以上にしてください。`;
  }
  if (name.length > USERNAME_MAX) {
    return `ユーザー名は${USERNAME_MAX}文字以内にしてください。`;
  }
  if (!USERNAME_RE.test(name)) {
    return "ユーザー名は半角英数字・ハイフン・アンダースコアのみ使えます。";
  }
  return null;
}
