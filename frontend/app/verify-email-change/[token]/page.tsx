"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Status = "loading" | "success" | "error";

export default function VerifyEmailChangePage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-email-change/${token}`,
        );
        const json = await res.json();

        if (res.ok) {
          setStatus("success");
        } else {
          setStatus("error");
          setMessage(json.error ?? "認証に失敗しました");
        }
      } catch {
        setStatus("error");
        setMessage("サーバーへの接続に失敗しました");
      }
    }

    verify();
  }, [token]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col gap-4 text-center">
        {status === "loading" && (
          <p className="text-gray-500">確認中...</p>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold">メールアドレスの変更が完了しました</h1>
            <p className="text-gray-500">
              新しいメールアドレスが設定されました。
            </p>
            <Link href="/settings" className="text-sm underline">
              設定ページへ戻る
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold">変更に失敗しました</h1>
            <p className="text-gray-500">{message}</p>
            <Link href="/settings" className="text-sm underline">
              設定ページで再度お試しください
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
