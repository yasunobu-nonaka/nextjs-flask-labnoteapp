"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UseFormRegisterReturn, FieldError } from "react-hook-form";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  identifier: z
    .string()
    .min(4, "4文字以上で入力してください")
    .max(100, "100文字以内で入力してください"),
  password: z
    .string()
    .min(12, "パスワードは12文字以上で入力してください")
    .max(64, "パスワードは64文字以内で入力してください"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const router = useRouter();

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
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
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
      } else if (res.status === 401) {
        setGlobalError("ユーザー名またはパスワードが正しくありません");
      } else if (!res.ok) {
        setGlobalError(json.message ?? "エラーが発生しました");
      } else {
        localStorage.setItem("access_token", json.access_token);
        localStorage.setItem("refresh_token", json.refresh_token);
        router.push("/notes");
      }
    } catch {
      setGlobalError("サーバーへの接続に失敗しました");
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">ログイン</h1>
          <p className="text-gray-500 text-sm">Lab Note App へようこそ。</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field
            label="ユーザー名またはメールアドレス"
            registration={register("identifier")}
            type="text"
            autoComplete="username"
            error={errors.identifier}
          />
          <Field
            label="パスワード"
            registration={register("password")}
            type="password"
            autoComplete="current-password"
            error={errors.password}
          />

          {globalError && (
            <p className="text-sm text-red-500">{globalError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="flex flex-col gap-2 text-sm text-center text-gray-500">
          <p>
            アカウントをお持ちでない方は{" "}
            <Link href="/register" className="underline text-foreground">
              新規登録
            </Link>
          </p>
          <p>
            <Link href="/forgot-password" className="underline">
              パスワードをお忘れの方
            </Link>
          </p>
        </div>
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
