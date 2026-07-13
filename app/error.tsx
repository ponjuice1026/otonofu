"use client";

import Link from "next/link";
import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="home-hero__eyebrow">Error</p>
      <h1 className="page-title mt-2">問題が発生しました</h1>
      <p className="page-desc mx-auto">
        予期しないエラーが発生しました。しばらくしてからもう一度お試しください。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => reset()} className="btn-primary">
          再試行
        </button>
        <Link href="/" className="btn-secondary">
          ホームへ戻る
        </Link>
      </div>
    </div>
  );
}
