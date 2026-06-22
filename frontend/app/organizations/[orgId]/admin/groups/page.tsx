"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";

type Group = {
  id: number;
  name: string;
  is_private: boolean;
  role: string | null;
};

/**
 * 組織管理: グループ一覧ページ。
 * 組織内のグループを一覧表示し、各グループの ⚙ アイコンからグループ管理画面へ遷移できる。
 * グループの編集・削除はグループ管理画面（/groups/[groupId]/admin）で行う。
 */
export default function ConsoleGroupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/groups`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setFetchError("グループ一覧の取得に失敗しました");
          setLoading(false);
          return;
        }
        const data: Group[] = await res.json();
        setGroups(data);
      } catch {
        setFetchError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchGroups();
  }, [orgId, router]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">グループ管理</h2>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : fetchError ? (
        <p className="text-red-500 text-sm">{fetchError}</p>
      ) : groups.length === 0 ? (
        <p className="text-gray-500">グループがありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
            >
              {/* グループ名と非公開バッジ */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-medium truncate">{g.name}</span>
                {g.is_private && (
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                    非公開
                  </span>
                )}
              </div>
              {/* ロールと管理画面へのリンク */}
              <div className="flex items-center gap-3 shrink-0">
                {g.role && (
                  <span className="text-sm text-gray-400">{g.role}</span>
                )}
                {/* ⚙ アイコン: グループ管理画面（基本設定・メンバー管理・ポリシー管理）へ遷移する */}
                <Link
                  href={`/organizations/${orgId}/groups/${g.id}/admin`}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title={`${g.name} の管理`}
                >
                  ⚙
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
