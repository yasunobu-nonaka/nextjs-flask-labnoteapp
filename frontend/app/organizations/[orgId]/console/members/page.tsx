"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";

type Member = {
  user_id: number;
  username: string;
  email: string;
  role: string;
  joined_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "オーナー",
  sys_admin: "システム管理者",
  user_admin: "ユーザー管理者",
  member: "メンバー",
};

const PER_PAGE = 20;

/**
 * 組織コンソール: メンバー一覧ページ。
 * 組織に所属するメンバーの一覧をロールとともに表示する。
 * ページネーションはクライアントサイドで処理する（全件取得後に分割）。
 */
export default function ConsoleMembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/members`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError("メンバー一覧の取得に失敗しました");
          setLoading(false);
          return;
        }
        const data: Member[] = await res.json();
        setMembers(data);
      } catch {
        setError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchMembers();
  }, [orgId, router]);

  const totalPages = Math.max(1, Math.ceil(members.length / PER_PAGE));
  const visibleMembers = members.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="flex flex-col gap-6">
      {/* ヘッダー: タイトルと招待ボタン */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">メンバー管理</h2>
        <Link
          href={`/organizations/${orgId}/console/members/invite`}
          className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
        >
          メンバーを招待
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : members.length === 0 ? (
        <p className="text-gray-500">メンバーがいません。</p>
      ) : (
        <>
          {/* メンバーテーブル */}
          <table className="w-full text-base border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                  ユーザー名
                </th>
                <th className="py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                  メールアドレス
                </th>
                <th className="py-2 px-3 font-semibold text-gray-500 dark:text-gray-400">
                  ロール
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((m) => (
                <tr
                  key={m.user_id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <td className="py-3 px-3 font-medium">{m.username}</td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-300">
                    {m.email}
                  </td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-300">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
              >
                ←
              </button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
