"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { ORG_ROLE_LABELS } from "@/lib/constants";
import ConfirmModal from "@/components/common/ConfirmModal";

type OrgData = {
  id: number;
  name: string;
  role: string;
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
  const [isNotFound, setIsNotFound] = useState(false);

  // 組織名編集フォームの入力値と保存状態
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 組織削除
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 404) {
          setIsNotFound(true);
          setLoading(false);
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

  /** 組織を削除し、組織一覧へリダイレクトする */
  async function handleDeleteOrg() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await authFetch(`/api/organizations/${orgId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setDeleteError(json.message ?? "削除に失敗しました");
        setShowDeleteConfirm(false);
        return;
      }
      router.push("/organizations");
    } catch {
      setDeleteError("サーバーへの接続に失敗しました");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }

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

  if (isNotFound) {
    notFound();
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
          {ORG_ROLE_LABELS[org?.role ?? ""] ?? org?.role}
        </p>
      </section>

      {/* 危険ゾーン: 組織削除（ownerのみ表示） */}
      {org?.role === "owner" && (
        <section className="flex flex-col gap-4 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
            危険ゾーン
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            組織を削除すると、組織内のすべてのグループ・ノート・フォルダー・メンバーが完全に削除されます。この操作は取り消せません。
          </p>
          {deleteError && (
            <p className="text-sm text-red-500">{deleteError}</p>
          )}
          <div>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="px-4 py-2 text-base rounded-lg border border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "削除中..." : "組織を削除"}
            </button>
          </div>
        </section>
      )}

      {/* 組織削除確認モーダル */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="組織を削除しますか？"
        message={`「${org?.name}」を削除します。\n組織内のすべてのグループ・ノート・フォルダー・メンバーが完全に削除されます。\nこの操作は取り消せません。`}
        confirmLabel="削除する"
        variant="danger"
        onConfirm={handleDeleteOrg}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
