"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  removeAvatar,
  uploadAvatar,
  type AvatarActionState,
} from "@/app/profile/actions";

type AvatarUploaderProps = {
  currentAvatarUrl: string | null;
  displayName: string;
};

const initialState: AvatarActionState = {};

function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const codePoint = trimmed.codePointAt(0);
  return codePoint ? String.fromCodePoint(codePoint) : "?";
}

export function AvatarUploader({
  currentAvatarUrl,
  displayName,
}: AvatarUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [state, formAction, pending] = useActionState(
    uploadAvatar,
    initialState,
  );
  const [isRemoving, startRemoving] = useTransition();

  const [prevAvatarUrl, setPrevAvatarUrl] = useState(currentAvatarUrl);
  if (currentAvatarUrl !== prevAvatarUrl) {
    setPrevAvatarUrl(currentAvatarUrl);
    setPreviewUrl(currentAvatarUrl);
  }

  const [prevUploadState, setPrevUploadState] = useState(state);
  if (state !== prevUploadState) {
    setPrevUploadState(state);
    if (state.success && state.avatarUrl) {
      setPreviewUrl(state.avatarUrl);
    }
  }

  useEffect(() => {
    if (state.success && state.avatarUrl) {
      router.refresh();
    }
  }, [state.success, state.avatarUrl, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    formRef.current?.requestSubmit();
  };

  const handleRemove = () => {
    if (!confirm("アバターを削除しますか?")) return;
    startRemoving(async () => {
      const result = await removeAvatar();
      if (result.error) {
        alert(result.error);
        return;
      }
      setPreviewUrl(null);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="アバター"
            fill
            className="object-cover"
            sizes="96px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-zinc-400">
            {initialsFor(displayName)}
          </div>
        )}
        {(pending || isRemoving) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-zinc-200">
            処理中…
          </div>
        )}
      </div>

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          name="avatar"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || isRemoving}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-60"
          >
            画像を選ぶ
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending || isRemoving}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-60"
            >
              削除
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          PNG / JPEG / WebP / GIF（最大 2MB）
        </p>
        {state.error && (
          <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300">
            {state.error}
          </p>
        )}
        {state.success && !state.error && (
          <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
            {state.success}
          </p>
        )}
      </form>
    </div>
  );
}
