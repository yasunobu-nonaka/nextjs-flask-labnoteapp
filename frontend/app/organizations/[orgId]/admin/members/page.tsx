"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

// owner はオーナー譲渡フロー（未実装）があるため、通常のロール変更からは除外する
const ASSIGNABLE_ROLES = ["sys_admin", "user_admin", "member"] as const;

const PER_PAGE = 20;

/**
 * 組織管理: メンバー一覧ページ。
 * メンバーのロール変更（複数一括）と削除ができる。
 *
 * ロール変更は pendingRoles に変更分だけ蓄積し、「ロールの変更を保存」ボタンで
 * 変更があったメンバー分だけ PATCH リクエストを送る。
 */
export default function ConsoleMembersPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // user_id → 変更後のロール。変更があったメンバーのみ保持する
  const [pendingRoles, setPendingRoles] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // マウント時にメンバー一覧を取得する
  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/members`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setFetchError("メンバー一覧の取得に失敗しました");
          setLoading(false);
          return;
        }
        const data: Member[] = await res.json();
        setMembers(data);
      } catch {
        setFetchError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchMembers();
  }, [orgId, router]);

  /**
   * ロール選択が変更されたときに pendingRoles を更新する。
   * 元のロールに戻した場合は pendingRoles から除去して変更なし扱いにする。
   */
  function handleRoleChange(
    userId: number,
    originalRole: string,
    newRole: string,
  ) {
    setSaveSuccess(false);
    setSaveError(null);
    if (newRole === originalRole) {
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } else {
      setPendingRoles((prev) => ({ ...prev, [userId]: newRole }));
    }
  }

  /**
   * pendingRoles にあるメンバーのロールを順次 PATCH で更新する。
   * 部分失敗した場合は成功分のみ state に反映し、失敗分はエラー表示する。
   */
  async function handleSaveRoles() {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const errors: string[] = [];
    // 成功した user_id → 新ロール のマップ
    const succeeded: Record<number, string> = {};

    for (const [userIdStr, newRole] of Object.entries(pendingRoles)) {
      const userId = Number(userIdStr);
      try {
        const res = await authFetch(
          `/api/organizations/${orgId}/members/${userId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ role: newRole }),
          },
        );
        if (res.ok) {
          succeeded[userId] = newRole;
        } else {
          const json = await res.json();
          const member = members.find((m) => m.user_id === userId);
          errors.push(
            `${member?.username ?? String(userId)}: ${json.message ?? "更新に失敗しました"}`,
          );
        }
      } catch {
        const member = members.find((m) => m.user_id === userId);
        errors.push(`${member?.username ?? String(userId)}: 接続エラー`);
      }
    }

    // 成功したメンバーの role を members state に反映し、pendingRoles から除去する
    if (Object.keys(succeeded).length > 0) {
      setMembers((prev) =>
        prev.map((m) =>
          succeeded[m.user_id] !== undefined
            ? { ...m, role: succeeded[m.user_id] }
            : m,
        ),
      );
      setPendingRoles((prev) => {
        const next = { ...prev };
        Object.keys(succeeded).forEach((id) => delete next[Number(id)]);
        return next;
      });
      if (errors.length === 0) setSaveSuccess(true);
    }

    if (errors.length > 0) {
      setSaveError(errors.join(" / "));
    }

    setIsSaving(false);
  }

  /** メンバーを組織から削除する */
  async function handleRemoveMember(member: Member) {
    if (
      !window.confirm(
        `${member.username} をこの組織から削除しますか？この操作は取り消せません。`,
      )
    )
      return;

    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/members/${member.user_id}`,
        { method: "DELETE" },
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const json = await res.json();
        alert(json.message ?? "削除に失敗しました");
        return;
      }
      // 削除成功: members state から除去し、pendingRoles からも除去する
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[member.user_id];
        return next;
      });
    } catch {
      alert("サーバーへの接続に失敗しました");
    }
  }

  const totalPages = Math.max(1, Math.ceil(members.length / PER_PAGE));
  const visibleMembers = members.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const hasPendingChanges = Object.keys(pendingRoles).length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ヘッダー: タイトルと招待ボタン */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">メンバー管理</h2>
        <Link
          href={`/organizations/${orgId}/admin/members/invite`}
          className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
        >
          メンバーを招待
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : fetchError ? (
        <p className="text-red-500 text-sm">{fetchError}</p>
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
                {/* 削除ボタン列のスペース */}
                <th className="py-2 px-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((m) => {
                // pendingRoles に登録されていれば変更後のロール、なければ元のロールを表示する
                const displayRole = pendingRoles[m.user_id] ?? m.role;
                const isChanged = pendingRoles[m.user_id] !== undefined;

                return (
                  <tr
                    key={m.user_id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  >
                    <td className="py-3 px-3 font-medium">{m.username}</td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-300">
                      {m.email}
                    </td>
                    <td className="py-3 px-3">
                      {/* owner は変更不可のため固定テキスト表示 */}
                      {m.role === "owner" ? (
                        <span className="text-gray-600 dark:text-gray-300">
                          {ROLE_LABELS.owner}
                        </span>
                      ) : (
                        <select
                          value={displayRole}
                          onChange={(e) =>
                            handleRoleChange(m.user_id, m.role, e.target.value)
                          }
                          className={[
                            "px-3 py-2 border rounded-md bg-transparent",
                            "focus:outline-none focus:ring-1 focus:ring-foreground",
                            isChanged
                              ? "border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400"
                              : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300",
                          ].join(" ")}
                        >
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {/* owner は削除不可 */}
                      {m.role !== "owner" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m)}
                          className="text-red-400 hover:text-red-500 transition-colors text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                          aria-label={`${m.username} を削除`}
                        >
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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

          {/* ロール変更保存エリア: 変更があるときのみ表示 */}
          {hasPendingChanges && (
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleSaveRoles}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {isSaving ? "保存中..." : "ロールの変更を保存"}
                </button>
                <span className="text-sm text-gray-500">
                  {Object.keys(pendingRoles).length} 件の変更があります
                </span>
              </div>
            </div>
          )}

          {/* 保存成功メッセージ */}
          {saveSuccess && !hasPendingChanges && (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ ロールを更新しました
            </p>
          )}
        </>
      )}
    </div>
  );
}
