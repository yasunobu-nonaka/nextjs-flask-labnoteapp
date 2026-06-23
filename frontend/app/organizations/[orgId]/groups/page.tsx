"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

/**
 * グループ一覧リダイレクトページ。
 * 組織切り替えモーダルなどから組織 ID のみ指定されて遷移した場合に、
 * 最初の所属グループのノート一覧へ自動的に転送する。
 * 所属グループが見つからない場合はグループ作成フォームを表示する。
 */
export default function GroupsRedirectPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  /* ローディングが終わりグループなしと確定したら true */
  const [showCreateForm, setShowCreateForm] = useState(false);

  /* グループ作成フォームの状態 */
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function redirect() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/groups`);
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          router.replace("/organizations");
          return;
        }
        const groups = await res.json();
        /* role が null でないものが所属グループ */
        const firstJoined = groups.find(
          (g: { role: string | null }) => g.role !== null,
        );
        if (firstJoined) {
          router.replace(
            `/organizations/${orgId}/groups/${firstJoined.id}/notes`,
          );
        } else {
          /* 所属グループがない場合はグループ作成フォームを表示する */
          setShowCreateForm(true);
        }
      } catch {
        router.replace("/organizations");
      }
    }
    redirect();
  }, [orgId, router]);

  /** グループ作成フォームの送信ハンドラ */
  async function handleCreateGroup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await authFetch(`/api/organizations/${orgId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim(), is_private: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error || "グループの作成に失敗しました");
        return;
      }
      const data = await res.json();
      /* 作成したグループのノート一覧へ遷移 */
      router.push(`/organizations/${orgId}/groups/${data.group.id}/notes`);
    } catch {
      setCreateError("グループの作成に失敗しました");
    } finally {
      setIsCreating(false);
    }
  }

  /* グループなし確定前はローディング表示 */
  if (!showCreateForm) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  return (
    /* グループがない組織に遷移したときの初期グループ作成画面 */
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-sm px-6 py-10">
        <h1 className="text-lg font-semibold text-center mb-1">
          グループがありません
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          最初のグループを作成してノートを始めましょう。
        </p>

        <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
          <div>
            {/* グループ名入力 */}
            <label className="block text-sm font-medium mb-1">
              グループ名
            </label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="例: 研究室A"
              autoFocus
              className="w-full rounded-md border border-gray-300 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
            />
          </div>

          {createError && (
            <p className="text-sm text-red-500">{createError}</p>
          )}

          <button
            type="submit"
            disabled={isCreating || !newGroupName.trim()}
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreating ? "作成中..." : "グループを作成"}
          </button>
        </form>
      </div>
    </main>
  );
}
