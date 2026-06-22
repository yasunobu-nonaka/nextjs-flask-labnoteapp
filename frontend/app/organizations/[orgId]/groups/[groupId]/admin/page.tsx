"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

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

  // 編集フォームの入力値（saved との差分を保存ボタン表示の判定に使う）
  const [editState, setEditState] = useState<EditState>({
    name: "",
    is_private: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  // 現在の入力値と保存済みの値を比較して変更があるか判定する
  const hasChanges =
    group !== null &&
    (editState.name.trim() !== group.name ||
      editState.is_private !== group.is_private);

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
    </div>
  );
}
