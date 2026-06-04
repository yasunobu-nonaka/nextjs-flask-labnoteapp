"use client";

import { useState } from "react";
import Link from "next/link";

type FieldErrors = Partial<Record<"username" | "email" | "password" | "confirm", string[]>>;

export default function RegisterPage() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();

      if (res.status === 400 && data.errors) {
        setFieldErrors(data.errors);
      } else if (!res.ok) {
        setGlobalError(data.message ?? "エラーが発生しました");
      } else {
        setSuccess(true);
      }
    } catch {
      setGlobalError("サーバーへの接続に失敗しました");
    } finally {
      setIsSubmitting(false);
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
          <p className="text-gray-500 text-sm">
            Lab Note App へようこそ。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            label="ユーザー名"
            name="username"
            type="text"
            autoComplete="username"
            errors={fieldErrors.username}
          />
          <Field
            label="メールアドレス"
            name="email"
            type="email"
            autoComplete="email"
            errors={fieldErrors.email}
          />
          <Field
            label="パスワード"
            name="password"
            type="password"
            autoComplete="new-password"
            errors={fieldErrors.password}
          />
          <Field
            label="パスワード（確認）"
            name="confirm"
            type="password"
            autoComplete="new-password"
            errors={fieldErrors.confirm}
          />

          {globalError && (
            <p className="text-sm text-red-500">{globalError}</p>
          )}

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
  name,
  type,
  autoComplete,
  errors,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  errors?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground"
      />
      {errors?.map((err, i) => (
        <p key={i} className="text-xs text-red-500">
          {err}
        </p>
      ))}
    </div>
  );
}
