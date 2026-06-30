"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UseFormRegisterReturn, FieldError } from "react-hook-form";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

type FormValues = z.infer<typeof schema>;

/**
 * パスワードを忘れた場合のリセットメール送信フォーム。
 * メールアドレスが登録済みかどうかを問わず同一のメッセージを表示し、
 * アカウント存在の有無が外部に漏れないようにする。
 */
export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    setServerError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (res.status >= 500) {
        const json = await res.json().catch(() => ({}));
        setServerError(json.error ?? "サーバーエラーが発生しました");
        return;
      }

      // 200 はメールの有無に関わらず同一レスポンスなので、常に送信完了扱いにする
      setSubmitted(true);
    } catch {
      setServerError("サーバーへの接続に失敗しました");
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">パスワードをお忘れの方</h1>
          <p className="text-gray-500 text-sm">
            登録済みのメールアドレスを入力してください。
          </p>
        </div>

        {submitted ? (
          /* 送信完了メッセージ */
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              メールを送信しました。登録済みのメールアドレスの場合、パスワードリセット用のリンクをお送りします。
            </p>
            <p className="text-sm text-gray-500">
              メールが届かない場合は迷惑メールフォルダをご確認ください。
            </p>
            <Link href="/login" className="text-sm underline text-center">
              ログインページへ戻る
            </Link>
          </div>
        ) : (
          /* メールアドレス入力フォーム */
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field
              label="メールアドレス"
              registration={register("email")}
              type="email"
              autoComplete="email"
              error={errors.email}
            />

            {serverError && (
              <p className="text-sm text-red-500">{serverError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? "送信中..." : "リセットメールを送信"}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-500">
          <Link href="/login" className="underline text-foreground">
            ログインページへ戻る
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  registration,
  type,
  autoComplete,
  error,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  type: string;
  autoComplete?: string;
  error?: FieldError;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={registration.name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={registration.name}
        {...registration}
        type={type}
        autoComplete={autoComplete}
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground"
      />
      {error && <p className="text-xs text-red-500">{error.message}</p>}
    </div>
  );
}
