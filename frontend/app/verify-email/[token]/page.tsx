"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify/${token}`,
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
          <p className="text-gray-500">認証中...</p>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold">メール認証が完了しました</h1>
            <p className="text-gray-500">
              アカウントが有効化されました。ログインしてください。
            </p>
            <Link href="/login" className="text-sm underline">
              ログインページへ
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold">認証に失敗しました</h1>
            <p className="text-gray-500">{message}</p>
            <Link href="/register" className="text-sm underline">
              登録ページへ戻る
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
