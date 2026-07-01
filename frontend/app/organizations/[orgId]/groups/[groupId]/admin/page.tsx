"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import ConfirmModal from "@/components/common/ConfirmModal";

type GroupData = {
  id: number;
  name: string;
  is_private: boolean;
  role: string | null;
};

type EditState = {
  name: string;
  is_private: boolean;
};

/**
 * グループ管理: 基本設定ページ。
 * グループ名と公開設定（公開/非公開）を編集できる。
 * 変更があるときのみ「保存」ボタンを表示する。
 */
export default function GroupAdminBasicPage() {
  const { orgId, groupId } = useParams<{ orgId: string; groupId: string }>();
  const router = useRouter();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  // 編集フォームの入力値（saved との差分を保存ボタン表示の判定に使う）
  const [editState, setEditState] = useState<EditState>({
    name: "",
    is_private: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // グループ削除
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGroup() {
      try {
        const res = await authFetch(
          `/api/organizations/${orgId}/groups/${groupId}`,
        );
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
          setFetchError("グループ情報の取得に失敗しました");
          setLoading(false);
          return;
        }
        const data: GroupData = await res.json();
        setGroup(data);
        setEditState({ name: data.name, is_private: data.is_private });
      } catch {
        setFetchError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchGroup();
  }, [orgId, groupId, router]);

  /** グループ名・公開設定を PATCH で保存する */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = editState.name.trim();
    if (!trimmedName) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: trimmedName,
            is_private: editState.is_private,
          }),
        },
      );
      if (!res.ok) {
        const json = await res.json();
        setSaveError(json.message ?? "保存に失敗しました");
        return;
      }
      const json = await res.json();
      setGroup((prev) =>
        prev
          ? { ...prev, name: json.name, is_private: json.is_private }
          : prev,
      );
      setEditState({ name: json.name, is_private: json.is_private });
      setSaveSuccess(true);
    } catch {
      setSaveError("サーバーへの接続に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  /** グループを削除し、組織のグループ一覧へリダイレクトする */
  async function handleDeleteGroup() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setDeleteError(json.message ?? "削除に失敗しました");
        setShowDeleteConfirm(false);
        return;
      }
      router.push(`/organizations/${orgId}/groups`);
    } catch {
      setDeleteError("サーバーへの接続に失敗しました");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }

  // 現在の入力値と保存済みの値を比較して変更があるか判定する
  const hasChanges =
    group !== null &&
    (editState.name.trim() !== group.name ||
      editState.is_private !== group.is_private);

  if (isNotFound) {
    notFound();
  }

  if (loading) return <p className="text-gray-500">読み込み中...</p>;
  if (fetchError) return <p className="text-red-500 text-sm">{fetchError}</p>;

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <h2 className="text-2xl font-bold">基本設定</h2>

      {/* グループ情報編集フォーム */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">グループ情報</h3>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* グループ名 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
              グループ名
            </label>
            <input
              value={editState.name}
              onChange={(e) => {
                setEditState((prev) => ({ ...prev, name: e.target.value }));
                setSaveSuccess(false);
              }}
              placeholder="グループ名"
              className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>

          {/* 公開設定 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
              公開設定
            </label>
            <select
              value={editState.is_private ? "private" : "public"}
              onChange={(e) => {
                setEditState((prev) => ({
                  ...prev,
                  is_private: e.target.value === "private",
                }));
                setSaveSuccess(false);
              }}
              className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="public">公開グループ</option>
              <option value="private">非公開グループ</option>
            </select>
          </div>

          {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          {saveSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ 保存しました
            </p>
          )}

          {/* 変更があるときのみ保存ボタンを表示する */}
          {hasChanges && (
            <div>
              <button
                type="submit"
                disabled={isSaving || !editState.name.trim()}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isSaving ? "保存中..." : "保存"}
              </button>
            </div>
          )}
        </form>
      </section>
      {/* 危険ゾーン: グループ削除（グループadminのみ表示） */}
      {group?.role === "admin" && (
        <section className="flex flex-col gap-4 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
            危険ゾーン
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            グループを削除すると、グループ内のすべてのノート・フォルダー・タグ・メンバーが完全に削除されます。この操作は取り消せません。
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
              {isDeleting ? "削除中..." : "グループを削除"}
            </button>
          </div>
        </section>
      )}

      {/* グループ削除確認モーダル */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="グループを削除しますか？"
        message={`「${group?.name}」を削除します。\nグループ内のすべてのノート・フォルダー・タグ・メンバーが完全に削除されます。\nこの操作は取り消せません。`}
        confirmLabel="削除する"
        variant="danger"
        onConfirm={handleDeleteGroup}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
