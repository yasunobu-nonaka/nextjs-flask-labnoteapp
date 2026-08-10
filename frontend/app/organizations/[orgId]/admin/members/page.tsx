"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import { ORG_ROLE_LABELS } from "@/lib/constants";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useAdmin } from "../admin-context";

type Member = {
  user_id: number;
  username: string;
  email: string;
  role: string;
  joined_at: string;
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
  // layout から渡される、自分が組織admin系ロールかどうかのフラグ。管理系UIの出し分けに使う
  const { isAdmin } = useAdmin();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [page, setPage] = useState(1);
  // 現在のユーザーの組織ロール（オーナー移譲ボタンの表示制御に使う）
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  // ログイン中の自分自身のuser_id。メンバー一覧の中から自分の行を特定し、脱退ボタンを出すために使う
  const [myUserId, setMyUserId] = useState<number | null>(null);

  // user_id → 変更後のロール。変更があったメンバーのみ保持する
  const [pendingRoles, setPendingRoles] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // 削除確認モーダルの対象（null = 非表示）
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  // オーナー移譲確認モーダルの対象（null = 非表示）
  const [memberToTransfer, setMemberToTransfer] = useState<Member | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  // 脱退確認モーダルの表示状態とエラー
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  // マウント時にメンバー一覧・現在ユーザーのロール・自分のuser_idを並行取得する
  useEffect(() => {
    async function fetchData() {
      try {
        const [membersRes, orgRes, meRes] = await Promise.all([
          authFetch(`/api/organizations/${orgId}/members`),
          authFetch(`/api/organizations/${orgId}`),
          authFetch(`/api/auth/me`),
        ]);
        if (membersRes.status === 401 || orgRes.status === 401) {
          router.push("/login");
          return;
        }
        if (membersRes.status === 404 || orgRes.status === 404) {
          setIsNotFound(true);
          setLoading(false);
          return;
        }
        if (!membersRes.ok || !orgRes.ok) {
          setFetchError("データの取得に失敗しました");
          setLoading(false);
          return;
        }
        const [membersData, orgData]: [Member[], { role: string }] =
          await Promise.all([membersRes.json(), orgRes.json()]);
        setMembers(membersData);
        setCurrentUserRole(orgData.role);
        if (meRes.ok) {
          const me: { id: number } = await meRes.json();
          setMyUserId(me.id);
        }
      } catch {
        setFetchError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
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

  /**
   * オーナー権限を指定メンバーに移譲する。
   * 移譲後、呼び出し元は member ロールになり管理画面へのアクセス権を失うため
   * グループ一覧ページへリダイレクトする。
   */
  async function handleTransferOwnership(member: Member) {
    setIsTransferring(true);
    setTransferError(null);
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/transfer-ownership`,
        {
          method: "POST",
          body: JSON.stringify({ user_id: member.user_id }),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setTransferError(json.message ?? "移譲に失敗しました");
        setMemberToTransfer(null);
        return;
      }
      // 移譲後は管理者権限を失うためグループ一覧へ戻る
      router.push(`/organizations/${orgId}/groups`);
    } catch {
      setTransferError("サーバーへの接続に失敗しました");
      setMemberToTransfer(null);
    } finally {
      setIsTransferring(false);
    }
  }

  /**
   * 自分自身をこの組織から脱退させる。
   * ownerの場合はバックエンドが409を返すため、そのメッセージをそのまま表示する。
   * 成功後はこの組織にアクセスできなくなるため組織一覧へ戻る。
   */
  async function handleLeaveOrganization() {
    setIsLeaving(true);
    setLeaveError(null);
    try {
      const res = await authFetch(`/api/organizations/${orgId}/leave`, {
        method: "POST",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setLeaveError(json.message ?? "脱退に失敗しました");
        return;
      }
      router.push("/organizations");
    } catch {
      setLeaveError("サーバーへの接続に失敗しました");
    } finally {
      setIsLeaving(false);
    }
  }

  /** メンバーを組織から削除する（確認モーダル経由で呼ばれる） */
  async function handleRemoveMember(member: Member) {
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

  if (isNotFound) {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(members.length / PER_PAGE));
  const visibleMembers = members.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const hasPendingChanges = Object.keys(pendingRoles).length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ヘッダー: タイトルと招待ボタン */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">メンバー管理</h2>
        {/* メンバー招待は組織admin系ロールのみ可能な操作 */}
        {isAdmin && (
          <Link
            href={`/organizations/${orgId}/admin/members/invite`}
            className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
          >
            メンバーを招待
          </Link>
        )}
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
                      {/* owner、または閲覧専用の非adminユーザーには固定テキスト表示 */}
                      {!isAdmin || m.role === "owner" ? (
                        <span className="text-gray-600 dark:text-gray-300">
                          {ORG_ROLE_LABELS[m.role as keyof typeof ORG_ROLE_LABELS]}
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
                              {ORG_ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* 現在のユーザーがオーナーで、かつ対象が非オーナーのときのみ移譲ボタンを表示する（admin限定操作） */}
                        {isAdmin && currentUserRole === "owner" && m.role !== "owner" && (
                          <button
                            type="button"
                            onClick={() => setMemberToTransfer(m)}
                            disabled={isTransferring}
                            className="text-blue-500 hover:text-blue-600 transition-colors text-sm px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-50"
                            aria-label={`${m.username} にオーナーを移譲`}
                          >
                            オーナー移譲
                          </button>
                        )}
                        {/* owner は削除不可。削除自体もadmin限定操作 */}
                        {isAdmin && m.role !== "owner" && (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(m)}
                            className="text-red-400 hover:text-red-500 transition-colors text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                            aria-label={`${m.username} を削除`}
                          >
                            削除
                          </button>
                        )}
                        {/* 自分自身の行にだけ脱退ボタンを表示する。ownerは先にオーナー移譲が必要 */}
                        {m.user_id === myUserId &&
                          (m.role === "owner" ? (
                            <span className="text-xs text-gray-400">
                              オーナーは移譲後に脱退できます
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsLeaveModalOpen(true)}
                              disabled={isLeaving}
                              className="text-orange-500 hover:text-orange-600 transition-colors text-sm px-2 py-1 rounded hover:bg-orange-50 dark:hover:bg-orange-950 disabled:opacity-50"
                              aria-label="この組織を脱退"
                            >
                              脱退する
                            </button>
                          ))}
                      </div>
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

          {/* ロール変更保存エリア: admin かつ変更があるときのみ表示 */}
          {isAdmin && hasPendingChanges && (
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
      {/* 移譲エラー表示 */}
      {transferError && <p className="text-sm text-red-500">{transferError}</p>}
      {/* 脱退エラー表示 */}
      {leaveError && <p className="text-sm text-red-500">{leaveError}</p>}

      {/* メンバー削除確認モーダル */}
      <ConfirmModal
        isOpen={memberToRemove !== null}
        title="メンバーを削除"
        message={`${memberToRemove?.username} をこの組織から削除しますか？\nこの操作は取り消せません。`}
        confirmLabel="削除"
        variant="danger"
        onConfirm={() => {
          if (memberToRemove) {
            const target = memberToRemove;
            setMemberToRemove(null);
            handleRemoveMember(target);
          }
        }}
        onCancel={() => setMemberToRemove(null)}
      />

      {/* オーナー移譲確認モーダル */}
      <ConfirmModal
        isOpen={memberToTransfer !== null}
        title="オーナーを移譲しますか？"
        message={`「${memberToTransfer?.username}」にオーナー権限を移譲します。\nあなたは member ロールに変更され、この画面にアクセスできなくなります。\nこの操作は取り消せません。`}
        confirmLabel="移譲する"
        variant="danger"
        onConfirm={() => {
          if (memberToTransfer) {
            const target = memberToTransfer;
            setMemberToTransfer(null);
            handleTransferOwnership(target);
          }
        }}
        onCancel={() => setMemberToTransfer(null)}
      />

      {/* 組織脱退確認モーダル */}
      <ConfirmModal
        isOpen={isLeaveModalOpen}
        title="組織を脱退しますか？"
        message="この組織から脱退します。この操作は取り消せません。"
        confirmLabel="脱退する"
        variant="danger"
        onConfirm={() => {
          setIsLeaveModalOpen(false);
          handleLeaveOrganization();
        }}
        onCancel={() => setIsLeaveModalOpen(false)}
      />
    </div>
  );
}
