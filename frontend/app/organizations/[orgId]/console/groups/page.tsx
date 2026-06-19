"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

type Group = {
  id: number;
  name: string;
  is_private: boolean;
  role: string | null;
};

/**
 * 組織コンソール: グループ管理ページ（Phase 5b 実装予定）。
 * 現在は組織内のグループ一覧を表示のみ。
 */
export default function ConsoleGroupsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/groups`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError("グループ一覧の取得に失敗しました");
          setLoading(false);
          return;
        }
        const data: Group[] = await res.json();
        setGroups(data);
      } catch {
        setError("サーバーへの接続に失敗しました");
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
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : groups.length === 0 ? (
        <p className="text-gray-500">グループがありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
            >
              <div className="flex items-center gap-2">
                <span className="text-base font-medium">{g.name}</span>
                {g.is_private && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                    非公開
                  </span>
                )}
              </div>
              {g.role && (
                <span className="text-sm text-gray-400">{g.role}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-4">
        グループの編集・削除機能は今後実装予定です。
      </p>
    </div>
  );
}
