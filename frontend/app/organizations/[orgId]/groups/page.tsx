"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";

type Group = {
  id: number;
  name: string;
  is_private: boolean;
  role: string;
};

/**
 * グループ一覧ページ
 * 指定された組織内のグループを表示し、新規グループの作成を行う。
 * グループをクリックするとノート一覧ページに遷移する。
 */
export default function GroupsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  // Next.js 15 ではルートパラメータが Promise になるため use() で unwrap する
  const { orgId } = use(params);
  const orgIdNum = Number(orgId);

  const [groups, setGroups] = useState<Group[]>([]);
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規グループ作成フォームの入力値と送信状態
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const router = useRouter();

  // マウント時に組織情報とグループ一覧を並行取得する
  useEffect(() => {
    async function fetchData() {
      try {
        const [orgRes, groupsRes] = await Promise.all([
          authFetch(`/api/organizations/${orgIdNum}`),
          authFetch(`/api/organizations/${orgIdNum}/groups`),
        ]);

        if (orgRes.status === 401 || groupsRes.status === 401) {
          router.push("/login");
          return;
        }
        if (!orgRes.ok || !groupsRes.ok) {
          setError("データの取得に失敗しました");
          setLoading(false);
          return;
        }

        const orgData = await orgRes.json();
        const groupsData: Group[] = await groupsRes.json();
        setOrgName(orgData.name ?? "");
        setGroups(groupsData);
      } catch {
        setError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [orgIdNum, router]);

  // グループを新規作成してリストに追加する
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await authFetch(`/api/organizations/${orgIdNum}/groups`, {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const json = await res.json();
        setCreateError(json.message ?? "作成に失敗しました");
        return;
      }
      const json = await res.json();
      setGroups((prev) => [...prev, { ...json.group, role: "admin" }]);
      setNewGroupName("");
    } catch {
      setCreateError("サーバーへの接続に失敗しました");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <Link
              href="/organizations"
              className="text-sm text-gray-500 hover:underline"
            >
              ← 組織一覧へ戻る
            </Link>
            <h1 className="text-3xl font-bold">
              {orgName ? `${orgName} のグループ` : "グループ一覧"}
            </h1>
          </div>
        </div>

        {/* 新規グループ作成フォーム */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">グループを作成</h2>
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="グループ名"
              className="flex-1 px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
            />
            <button
              type="submit"
              disabled={isCreating || !newGroupName.trim()}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isCreating ? "作成中..." : "作成"}
            </button>
          </form>
          {createError && <p className="text-sm text-red-500">{createError}</p>}
        </section>

        {/* グループ一覧 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">グループ一覧</h2>
          {loading ? (
            <p className="text-gray-500 text-base">読み込み中...</p>
          ) : error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : groups.length === 0 ? (
            <p className="text-gray-500 text-base">グループがありません。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {groups.map((group) => (
                <li key={group.id}>
                  {/* グループカード: クリックでノート一覧へ遷移する */}
                  <Link
                    href={`/organizations/${orgIdNum}/groups/${group.id}/notes`}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium">{group.name}</span>
                      {group.is_private && (
                        <span className="text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                          非公開
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-400">{group.role}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
