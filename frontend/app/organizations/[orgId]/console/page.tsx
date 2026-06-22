"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

type OrgData = {
  id: number;
  name: string;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "オーナー",
  sys_admin: "システム管理者",
  user_admin: "ユーザー管理者",
  member: "メンバー",
};

/**
 * 組織管理: 基本設定ページ。
 * 組織名の表示・編集と、現在のユーザーロールを表示する。
 */
export default function ConsoleBasicPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 組織名編集フォームの入力値と保存状態
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError("組織情報の取得に失敗しました");
          setLoading(false);
          return;
        }
        const data: OrgData = await res.json();
        setOrg(data);
        setEditName(data.name);
      } catch {
        setError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, [orgId, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === org?.name) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await authFetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const json = await res.json();
        setSaveError(json.message ?? "保存に失敗しました");
        return;
      }
      const json = await res.json();
      setOrg((prev) =>
        prev ? { ...prev, name: json.organization.name } : prev
      );
      setEditName(json.organization.name);
      setSaveSuccess(true);
    } catch {
      setSaveError("サーバーへの接続に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500">読み込み中...</p>;
  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <h2 className="text-2xl font-bold">基本設定</h2>

      {/* 組織名編集フォーム */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">組織名</h3>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <input
            value={editName}
            onChange={(e) => {
              setEditName(e.target.value);
              setSaveSuccess(false);
            }}
            placeholder="組織名"
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
                isSaving ||
                !editName.trim() ||
                editName.trim() === org?.name
              }
              className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isSaving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </section>

      {/* ロール表示 */}
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">あなたのロール</h3>
        <p className="text-base text-gray-600 dark:text-gray-300">
          {ROLE_LABELS[org?.role ?? ""] ?? org?.role}
        </p>
      </section>
    </div>
  );
}
