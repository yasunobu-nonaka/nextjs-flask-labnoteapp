"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UseFormRegisterReturn, FieldError } from "react-hook-form";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

const schema = z
  .object({
    username: z
      .string()
      .min(1, "ユーザー名は必須です")
      .max(100, "ユーザー名は100文字以内で入力してください"),
    email: z
      .email("有効なメールアドレスを入力してください")
      .min(1, "メールアドレスは必須です")
      .max(100, "メールアドレスは100文字以内で入力してください"),
    password: z
      .string()
      .min(12, "パスワードは12文字以上で入力してください")
      .max(64, "パスワードは64文字以内で入力してください"),
    confirm: z
      .string()
      .min(1, "パスワード（確認）は必須です")
      .max(64, "パスワード（確認）は64文字以内で入力してください"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "パスワードが一致しません",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    setGlobalError(null);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const json = await res.json();

      if (res.status === 400 && json.errors) {
        for (const [field, messages] of Object.entries(json.errors) as [
          keyof FormValues,
          string[],
        ][]) {
          setError(field, { message: (messages as string[]).join(" ") });
        }
      } else if (!res.ok) {
        setGlobalError(json.message ?? "エラーが発生しました");
      } else {
        setSuccess(true);
      }
    } catch {
      setGlobalError("サーバーへの接続に失敗しました");
    }
  }

  if (success) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        <div className="w-full max-w-md flex flex-col gap-4 text-center">
          <h1 className="text-2xl font-bold">登録が完了しました</h1>
          <p className="text-gray-500">
            確認メールを送信しました。メール内のリンクをクリックして、アカウントを有効化してください。
          </p>
          <Link href="/login" className="text-sm underline">
            ログインページへ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">アカウント登録</h1>
          <p className="text-gray-500 text-sm">Lab Note App へようこそ。</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field
            label="ユーザー名"
            registration={register("username")}
            type="text"
            autoComplete="username"
            error={errors.username}
          />
          <Field
            label="メールアドレス"
            registration={register("email")}
            type="email"
            autoComplete="email"
            error={errors.email}
          />
          <Field
            label="パスワード"
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

          {globalError && <p className="text-sm text-red-500">{globalError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? "登録中..." : "登録する"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="underline text-foreground">
            ログイン
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
