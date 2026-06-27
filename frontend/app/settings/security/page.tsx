"use client";

import { useState } from "react";
import { authFetch } from "@/lib/api";

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  /* クライアントサイドの入力チェック */
  const clientError =
    newPassword && confirmPassword && newPassword !== confirmPassword
      ? "新しいパスワードが一致しません"
      : null;

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault();
    if (clientError) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
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
        setSaveError(json.message ?? "変更に失敗しました");
        return;
      }
      /* 成功時はフォームをリセットする */
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaveSuccess(true);
    } catch {
      setSaveError("サーバーへの接続に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <h2 className="text-2xl font-bold">セキュリティ</h2>
      {/* パスワード変更フォーム */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">パスワード変更</h3>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setSaveSuccess(false);
            }}
            placeholder="現在のパスワード"
            className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setSaveSuccess(false);
            }}
            placeholder="新しいパスワード（12文字以上）"
            className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setSaveSuccess(false);
            }}
            placeholder="新しいパスワード（確認）"
            className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          {clientError && (
            <p className="text-sm text-red-500">{clientError}</p>
          )}
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          {saveSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">
              パスワードを変更しました
            </p>
          )}
          <div>
            <button
              type="submit"
              disabled={
                isSaving ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                !!clientError
              }
              className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isSaving ? "変更中..." : "パスワードを変更"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
