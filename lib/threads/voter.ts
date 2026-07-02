import { cookies } from "next/headers";

const COOKIE_NAME = "otonofu_poll_voter";
const MAX_AGE = 60 * 60 * 24 * 365;

export async function getVoterKey(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value?.trim();
  if (!value || value.length < 16) return null;
  return value;
}

export async function getOrCreateVoterKey(): Promise<string> {
  const existing = await getVoterKey();
  if (existing) return existing;

  const key = crypto.randomUUID();
  const store = await cookies();
  store.set(COOKIE_NAME, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });

  return key;
}
