"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UseFormRegisterReturn, FieldError } from "react-hook-form";
import Link from "next/link";
import { z } from "zod";

const schema = z
  .object({
    password: z
      .string()
      .min(12, "パスワードは12文字以上で入力してください")
      .max(64, "パスワードは64文字以内で入力してください"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "パスワードが一致しません",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

/**
 * パスワードリセットページ。
 * URLパラメータのトークンをマウント時に検証し、有効であれば新パスワード入力フォームを表示する。
 * トークン無効 / 期限切れの場合はエラーを表示して forgot-password への誘導リンクを示す。
 */
export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();

  type PageStatus = "validating" | "invalid" | "form" | "success";
  const [status, setStatus] = useState<PageStatus>("validating");
  const [tokenError, setTokenError] = useState<string | null>(null);

  // マウント時にトークンの有効性を確認する
  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/reset-password/${token}`,
        );

        if (res.ok) {
          setStatus("form");
        } else {
          const json = await res.json().catch(() => ({}));
          setTokenError(json.error ?? "リンクが無効または期限切れです");
          setStatus("invalid");
        }
      } catch {
        setTokenError("サーバーへの接続に失敗しました");
        setStatus("invalid");
      }
    }

    validateToken();
  }, [token]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* トークン検証中 */}
        {status === "validating" && (
          <p className="text-gray-500 text-center">確認中...</p>
        )}

        {/* トークン無効 */}
        {status === "invalid" && (
          <div className="flex flex-col gap-4 text-center">
            <h1 className="text-2xl font-bold">リンクが無効です</h1>
            <p className="text-gray-500 text-sm">{tokenError}</p>
            <Link href="/forgot-password" className="text-sm underline">
              パスワードリセットをやり直す
            </Link>
          </div>
        )}

        {/* 新パスワード入力フォーム */}
        {status === "form" && (
          <ResetForm token={token} onSuccess={() => setStatus("success")} />
        )}

        {/* リセット完了 */}
        {status === "success" && (
          <div className="flex flex-col gap-4 text-center">
            <h1 className="text-2xl font-bold">パスワードを変更しました</h1>
            <p className="text-gray-500 text-sm">
              新しいパスワードでログインしてください。
            </p>
            <Link href="/login" className="text-sm underline">
              ログインページへ
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * 新パスワード入力フォーム。
 * 送信成功時に onSuccess を呼び出して親コンポーネントを success 状態に遷移させる。
 */
function ResetForm({
  token,
  onSuccess,
}: {
  token: string;
  onSuccess: () => void;
}) {
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    setGlobalError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password: data.password, confirm: data.confirm }),
        },
      );

      if (res.ok) {
        onSuccess();
      } else {
        const json = await res.json().catch(() => ({}));
        setGlobalError(json.error ?? "エラーが発生しました");
      }
    } catch {
      setGlobalError("サーバーへの接続に失敗しました");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">新しいパスワードの設定</h1>
        <p className="text-gray-500 text-sm">
          新しいパスワードを入力してください。
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field
          label="新しいパスワード"
          registration={register("password")}
          type="password"
          autoComplete="new-password"
          error={errors.password}
        />
        <Field
          label="パスワード（確認）"
          registration={register("confirm")}
          type="password"
          autoComplete="new-password"
          error={errors.confirm}
        />

        {globalError && (
          <p className="text-sm text-red-500">{globalError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? "変更中..." : "パスワードを変更する"}
        </button>
      </form>
    </>
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
