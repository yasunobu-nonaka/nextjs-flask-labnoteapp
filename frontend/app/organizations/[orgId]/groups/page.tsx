"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";

type Group = {
  id: number;
  name: string;
  is_private: boolean;
  // グループメンバーでない場合は null になる
  role: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

/**
 * グループ一覧ページ。
 * role が null かどうかで所属グループと未所属グループに表示を分ける。
 * 所属グループはノート一覧へのリンク、未所属グループは参加申請ボタン（後で実装）を表示する。
 */
export default function GroupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const orgIdNum = Number(orgId);

  const [groups, setGroups] = useState<Group[]>([]);
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規グループ作成フォームの入力値と送信状態
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);
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
        body: JSON.stringify({ name: trimmed, is_private: newGroupIsPrivate }),
      });
      if (!res.ok) {
        const json = await res.json();
        setCreateError(json.message ?? "作成に失敗しました");
        return;
      }
      const json = await res.json();
      // 作成者は自動的に admin になる
      setGroups((prev) => [...prev, { ...json.group, role: "admin" }]);
      setNewGroupName("");
      setNewGroupIsPrivate(false);
    } catch {
      setCreateError("サーバーへの接続に失敗しました");
    } finally {
      setIsCreating(false);
    }
  }

  // role が null かどうかで所属判定する
  const joinedGroups = groups.filter((g) => g.role !== null);
  const unjoinedGroups = groups.filter((g) => g.role === null);

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
          {/* 名前・公開設定・作成ボタンを一列に並べる */}
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="グループ名"
              className="flex-1 px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
            />
            <select
              value={newGroupIsPrivate ? "private" : "public"}
              onChange={(e) => setNewGroupIsPrivate(e.target.value === "private")}
              className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="public">公開グループ</option>
              <option value="private">非公開グループ</option>
            </select>
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

        {loading ? (
          <p className="text-gray-500 text-base">読み込み中...</p>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : groups.length === 0 ? (
          <p className="text-gray-500 text-base">グループがありません。</p>
        ) : (
          <div className="flex flex-col gap-8">
            {/* 所属グループ */}
            {joinedGroups.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">所属グループ</h2>
                <ul className="flex flex-col gap-2">
                  {joinedGroups.map((group) => (
                    <li key={group.id}>
                      {/* 所属グループはノート一覧へのリンク */}
                      <Link
                        href={`/organizations/${orgIdNum}/groups/${group.id}/notes`}
                        className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base font-medium">
                            {group.name}
                          </span>
                          {group.is_private && (
                            <span className="text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                              非公開
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-400">
                          {ROLE_LABELS[group.role!] ?? group.role}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 未所属グループ */}
            {unjoinedGroups.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">未所属グループ</h2>
                <ul className="flex flex-col gap-2">
                  {unjoinedGroups.map((group) => (
                    <li key={group.id}>
                      <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-medium">
                            {group.name}
                          </span>
                          {group.is_private && (
                            <span className="text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                              非公開
                            </span>
                          )}
                        </div>
                        {/* 参加申請ボタン（バックエンド未実装のため現在は無効） */}
                        <button
                          type="button"
                          disabled
                          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed"
                          title="この機能は近日公開予定です"
                        >
                          参加を申請する
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
