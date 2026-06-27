"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";

export default function SettingHomePage() {
  // 保存済みのユーザー名: 変更前との比較に使う
  const [savedUsername, setSavedUsername] = useState("");

  // ユーザー名編集フォームの入力値と保存状態
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    authFetch("/api/auth/me").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setSavedUsername(data.username);
        setEditName(data.username);
      }
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === savedUsername) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await authFetch("/api/auth/me/username", {
        method: "PATCH",
        body: JSON.stringify({ username: trimmed }),
      });
      if (!res.ok) {
        const json = await res.json();
        setSaveError(json.message ?? "保存に失敗しました");
        return;
      }
      const json = await res.json();
      setSavedUsername(json.username);
      setEditName(json.username);
      setSaveSuccess(true);
    } catch {
      setSaveError("サーバーへの接続に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <h2 className="text-2xl font-bold">基本設定</h2>
      {/* ユーザー名編集フォーム */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">ユーザー名</h3>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <input
            value={editName}
            onChange={(e) => {
              setEditName(e.target.value);
              setSaveSuccess(false);
            }}
            placeholder="ユーザー名"
            className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          {saveSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">
              保存しました
            </p>
          )}
          <div>
            <button
              type="submit"
              disabled={
                isSaving || !editName.trim() || editName.trim() === savedUsername
              }
              className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isSaving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
