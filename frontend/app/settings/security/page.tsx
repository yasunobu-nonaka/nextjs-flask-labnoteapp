"use client";

import { useState } from "react";
import { authFetch } from "@/lib/api";

// パスワード変更フローのステップ
// "idle":   デフォルト表示（マスクされたパスワードと変更ボタン）
// "verify": 現在のパスワードを確認する
// "change": 新しいパスワードを入力する
type PasswordStep = "idle" | "verify" | "change";

// ステップ1: 現在のパスワードを入力して認証するフォーム
function VerifyPasswordForm({
  currentPassword,
  onCurrentPasswordChange,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: {
  currentPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onSubmit: (e: React.SyntheticEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        type="password"
        value={currentPassword}
        onChange={(e) => onCurrentPasswordChange(e.target.value)}
        placeholder="現在のパスワード"
        className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-base hover:opacity-80 transition-opacity"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !currentPassword}
          className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? "確認中..." : "次へ"}
        </button>
      </div>
    </form>
  );
}

// ステップ2: 新しいパスワードと確認用パスワードを入力するフォーム
function ChangePasswordForm({
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBack,
  isSubmitting,
  error,
  clientError,
}: {
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: React.SyntheticEvent) => void;
  onBack: () => void;
  isSubmitting: boolean;
  error: string | null;
  clientError: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        type="password"
        value={newPassword}
        onChange={(e) => onNewPasswordChange(e.target.value)}
        placeholder="新しいパスワード（12文字以上）"
        className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => onConfirmPasswordChange(e.target.value)}
        placeholder="新しいパスワード（確認）"
        className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
      />
      {clientError && <p className="text-sm text-red-500">{clientError}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-base hover:opacity-80 transition-opacity"
        >
          戻る
        </button>
        <button
          type="submit"
          disabled={
            isSubmitting || !newPassword || !confirmPassword || !!clientError
          }
          className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? "変更中..." : "パスワードを変更"}
        </button>
      </div>
    </form>
  );
}

// セキュリティ設定ページ
// パスワード変更を3ステップで行う:
//   idle   → 「パスワードを変更」ボタンを押してフローを開始
//   verify → 現在のパスワードを認証
//   change → 新パスワードを設定
export default function SecurityPage() {
  const [step, setStep] = useState<PasswordStep>("idle");

  // 現在のパスワード（ステップ1で入力し、ステップ2の最終送信にも使う）
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /* クライアントサイドの入力チェック */
  const clientError =
    newPassword && confirmPassword && newPassword !== confirmPassword
      ? "新しいパスワードが一致しません"
      : null;

  /** フローを開始する */
  function handleStartChange() {
    setStep("verify");
    setSaveSuccess(false);
    setError(null);
  }

  /** キャンセル: すべてリセットして idle に戻る */
  function handleCancel() {
    setStep("idle");
    setCurrentPassword("");
    setError(null);
  }

  /** ステップ1: 現在のパスワードをサーバーに検証してもらう */
  async function handleVerify(e: React.SyntheticEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("/api/auth/me/password/verify", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "認証に失敗しました");
        return;
      }
      setStep("change");
    } catch {
      setError("サーバーへの接続に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  /** ステップ2: 新しいパスワードに変更する */
  async function handleChange(e: React.SyntheticEvent) {
    e.preventDefault();
    if (clientError) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("/api/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
          confirm: confirmPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "変更に失敗しました");
        return;
      }
      /* 成功時はすべてリセットして idle に戻り、成功メッセージを表示する */
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStep("idle");
      setSaveSuccess(true);
    } catch {
      setError("サーバーへの接続に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  /** 「戻る」ボタン: 新パスワード入力を破棄してステップ1に戻す */
  function handleBack() {
    setStep("verify");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <h2 className="text-2xl font-bold">セキュリティ</h2>
      {/* パスワード変更セクション */}
      <section className="flex flex-col gap-4">
        {step === "idle" && (
          /* デフォルト: マスクされたパスワードと変更ボタンを表示する */
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold mr-4">パスワード</h3>
              <p className="text-gray-500 dark:text-gray-400 tracking-widest">
                ••••••••
              </p>
              <button
                onClick={handleStartChange}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-base hover:opacity-80 transition-opacity"
              >
                パスワードを変更
              </button>
            </div>
            {saveSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">
                パスワードを変更しました
              </p>
            )}
          </div>
        )}
        {step === "verify" && (
          <VerifyPasswordForm
            currentPassword={currentPassword}
            onCurrentPasswordChange={(value) => {
              setCurrentPassword(value);
              setError(null);
            }}
            onSubmit={handleVerify}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}
        {step === "change" && (
          <ChangePasswordForm
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onNewPasswordChange={(value) => {
              setNewPassword(value);
              setError(null);
            }}
            onConfirmPasswordChange={(value) => {
              setConfirmPassword(value);
              setError(null);
            }}
            onSubmit={handleChange}
            onBack={handleBack}
            isSubmitting={isSubmitting}
            error={error}
            clientError={clientError}
          />
        )}
      </section>
    </div>
  );
}
