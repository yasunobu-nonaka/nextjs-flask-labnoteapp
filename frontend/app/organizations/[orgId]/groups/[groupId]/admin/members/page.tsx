"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import Modal from "@/components/Modal";
import { usePendingCount } from "../pending-count-context";

type GroupMember = {
  user_id: number;
  username: string;
  email: string;
  role: string;
  status: string;
  joined_at: string;
};

/** 参加申請中のメンバー（status='pending'）の表示用型 */
type JoinRequest = {
  user_id: number;
  username: string;
  email: string;
  joined_at: string;
};

type OrgMember = {
  user_id: number;
  username: string;
  email: string;
  role: string;
};

/** モーダル内で選択・追加予定のメンバー */
type PendingMember = {
  userId: number;
  username: string;
  email: string;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

/** グループ内で変更可能なロール一覧（全ロールが対象） */
const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"] as const;

/**
 * グループ管理: メンバー管理ページ。
 * グループメンバーのロール変更（複数一括）・削除・追加ができる。
 *
 * ロール変更は pendingRoles に変更分だけ蓄積し、「変更を保存」ボタンで
 * 変更があったメンバー分だけ PATCH リクエストを送る。
 *
 * メンバー追加はモーダルで複数メンバーをリストに積んでから一括 POST する。
 */
export default function GroupAdminMembersPage() {
  const { orgId, groupId } = useParams<{ orgId: string; groupId: string }>();
  const router = useRouter();

  // layout のサイドバーバッジを承認・拒否後に更新するための再取得関数
  const { refreshPendingCount } = usePendingCount();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // user_id → 変更後のロール。変更があったメンバーのみ保持する
  const [pendingRoles, setPendingRoles] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // メンバー追加モーダルの状態
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 組織メンバー一覧（モーダルのドロップダウン用）
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);

  // モーダル内の現在の選択状態
  const [addUserId, setAddUserId] = useState<number | "">("");
  const [addRole, setAddRole] = useState<string>("editor");

  // 追加予定メンバーのリスト（モーダル内でリストに積んだもの）
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);

  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // 参加申請一覧の状態
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null);

  // マウント時にグループメンバーと組織メンバー一覧と参加申請を並行取得する
  useEffect(() => {
    async function fetchData() {
      try {
        const [membersRes, orgMembersRes, joinRequestsRes] = await Promise.all([
          authFetch(`/api/organizations/${orgId}/groups/${groupId}/members`),
          authFetch(`/api/organizations/${orgId}/members`),
          authFetch(`/api/organizations/${orgId}/groups/${groupId}/join-requests`),
        ]);
        if (membersRes.status === 401) {
          router.push("/login");
          return;
        }
        if (!membersRes.ok) {
          setFetchError("メンバー一覧の取得に失敗しました");
          setLoading(false);
          return;
        }
        const membersData: GroupMember[] = await membersRes.json();
        setMembers(membersData);

        if (orgMembersRes.ok) {
          const orgMembersData: OrgMember[] = await orgMembersRes.json();
          setOrgMembers(orgMembersData);
        }

        if (joinRequestsRes.ok) {
          const requestsData: JoinRequest[] = await joinRequestsRes.json();
          setJoinRequests(requestsData);
        }
      } catch {
        setFetchError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [orgId, groupId, router]);

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
    const succeeded: Record<number, string> = {};

    for (const [userIdStr, newRole] of Object.entries(pendingRoles)) {
      const userId = Number(userIdStr);
      try {
        const res = await authFetch(
          `/api/organizations/${orgId}/groups/${groupId}/members/${userId}`,
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

  /** 参加申請を承認する。承認されたメンバーをアクティブメンバーリストに追加する */
  async function handleApprove(req: JoinRequest) {
    setProcessingIds((prev) => new Set(prev).add(req.user_id));
    setJoinRequestError(null);
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}/join-requests/${req.user_id}`,
        { method: "PATCH", body: JSON.stringify({ action: "approve" }) },
      );
      if (!res.ok) {
        const json = await res.json();
        setJoinRequestError(json.message ?? "承認に失敗しました");
        return;
      }
      const json = await res.json();
      setMembers((prev) => [...prev, json.member]);
      setJoinRequests((prev) => prev.filter((r) => r.user_id !== req.user_id));
      refreshPendingCount();
    } catch {
      setJoinRequestError("サーバーへの接続に失敗しました");
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(req.user_id); return s; });
    }
  }

  /** 参加申請を拒否する */
  async function handleReject(req: JoinRequest) {
    setProcessingIds((prev) => new Set(prev).add(req.user_id));
    setJoinRequestError(null);
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}/join-requests/${req.user_id}`,
        { method: "PATCH", body: JSON.stringify({ action: "reject" }) },
      );
      if (!res.ok && res.status !== 204) {
        const json = await res.json();
        setJoinRequestError(json.message ?? "拒否に失敗しました");
        return;
      }
      setJoinRequests((prev) => prev.filter((r) => r.user_id !== req.user_id));
      refreshPendingCount();
    } catch {
      setJoinRequestError("サーバーへの接続に失敗しました");
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(req.user_id); return s; });
    }
  }

  /** メンバーをグループから削除する */
  async function handleRemoveMember(member: GroupMember) {
    if (
      !window.confirm(
        `${member.username} をこのグループから削除しますか？この操作は取り消せません。`,
      )
    )
      return;

    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}/members/${member.user_id}`,
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

  /**
   * 選択中のメンバーを追加予定リストに積む。
   * ドロップダウンから選ばれたメンバーを pendingMembers に追加し、選択をリセットする。
   */
  function handleAddToPending() {
    if (addUserId === "") return;
    const member = addableOrgMembers.find((m) => m.user_id === addUserId);
    if (!member) return;
    setPendingMembers((prev) => [
      ...prev,
      { userId: member.user_id, username: member.username, email: member.email, role: addRole },
    ]);
    setAddUserId("");
  }

  /** 追加予定リストから1件取り除く */
  function handleRemoveFromPending(userId: number) {
    setPendingMembers((prev) => prev.filter((p) => p.userId !== userId));
  }

  /**
   * 追加予定リストのメンバーをまとめてグループに POST する。
   * 部分失敗した場合は成功分だけ members に反映し、失敗分は pending に残してエラー表示する。
   */
  async function handleSubmitAddMembers() {
    if (pendingMembers.length === 0) return;
    setIsAdding(true);
    setAddError(null);

    const errors: string[] = [];
    const addedMembers: GroupMember[] = [];
    const failedUserIds = new Set<number>();

    for (const pending of pendingMembers) {
      try {
        const res = await authFetch(
          `/api/organizations/${orgId}/groups/${groupId}/members`,
          {
            method: "POST",
            body: JSON.stringify({ user_id: pending.userId, role: pending.role }),
          },
        );
        if (res.ok) {
          const json = await res.json();
          addedMembers.push(json.member);
        } else {
          const json = await res.json();
          errors.push(`${pending.username}: ${json.message ?? "追加に失敗しました"}`);
          failedUserIds.add(pending.userId);
        }
      } catch {
        errors.push(`${pending.username}: 接続エラー`);
        failedUserIds.add(pending.userId);
      }
    }

    if (addedMembers.length > 0) {
      setMembers((prev) => [...prev, ...addedMembers]);
    }

    if (errors.length > 0) {
      // 失敗したメンバーのみ pending に残す
      setPendingMembers((prev) => prev.filter((p) => failedUserIds.has(p.userId)));
      setAddError(errors.join(" / "));
    } else {
      // 全員成功: モーダルを閉じてリセット
      setPendingMembers([]);
      setAddUserId("");
      setAddRole("editor");
      setIsAddModalOpen(false);
    }

    setIsAdding(false);
  }

  /** モーダルを閉じてフォーム状態をリセットする */
  function handleCloseModal() {
    setIsAddModalOpen(false);
    setPendingMembers([]);
    setAddUserId("");
    setAddRole("editor");
    setAddError(null);
  }

  const hasPendingChanges = Object.keys(pendingRoles).length > 0;

  // 組織メンバーのうちグループ未参加かつ追加予定でないメンバーを抽出する
  const currentMemberIds = new Set(members.map((m) => m.user_id));
  const pendingMemberIds = new Set(pendingMembers.map((p) => p.userId));
  const addableOrgMembers = orgMembers.filter(
    (m) => !currentMemberIds.has(m.user_id) && !pendingMemberIds.has(m.user_id),
  );

  return (
    <div className="flex flex-col gap-8">
      {/* ページヘッダー: タイトルと追加ボタンを横並びに配置 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">メンバー管理</h2>
        {!loading && !fetchError && (currentMemberIds.size + pendingMemberIds.size) < orgMembers.length && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            メンバーを追加
          </button>
        )}
      </div>

      {/* 参加申請一覧: 申請が1件以上あるときのみ表示する */}
      {joinRequests.length > 0 && (
        <section className="flex flex-col gap-3 p-5 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30">
          <h3 className="text-lg font-semibold">
            参加申請（{joinRequests.length} 件）
          </h3>
          {joinRequestError && (
            <p className="text-sm text-red-500">{joinRequestError}</p>
          )}
          <ul className="flex flex-col gap-2">
            {joinRequests.map((req) => {
              const isProcessing = processingIds.has(req.user_id);
              return (
                <li
                  key={req.user_id}
                  className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium truncate">{req.username}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {req.email}
                    </span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApprove(req)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 text-sm rounded-lg bg-foreground text-background font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      承認
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(req)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      拒否
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* メンバー一覧 */}
      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : fetchError ? (
        <p className="text-red-500 text-sm">{fetchError}</p>
      ) : members.length === 0 ? (
        <p className="text-gray-500">メンバーがいません。</p>
      ) : (
        <div className="flex flex-col gap-4">
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
                <th className="py-2 px-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
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
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m)}
                        className="text-red-400 hover:text-red-500 transition-colors text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
                        aria-label={`${m.username} を削除`}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ロール変更保存エリア: 変更があるときのみ表示 */}
          {hasPendingChanges && (
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              {saveError && (
                <p className="text-sm text-red-500">{saveError}</p>
              )}
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

          {saveSuccess && !hasPendingChanges && (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ ロールを更新しました
            </p>
          )}
        </div>
      )}

      {/* メンバー追加モーダル */}
      {isAddModalOpen && (
        <Modal title="メンバーを追加" onClose={handleCloseModal}>
          <div className="flex flex-col gap-5">
            {/* メンバー選択行: ドロップダウン + ロール + リストに追加ボタン */}
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex flex-col gap-1 flex-1 min-w-48">
                <label className="text-sm font-medium">メンバー</label>
                {/* 組織メンバーのうちグループ未参加かつ追加予定でないメンバーを表示する */}
                <select
                  value={addUserId}
                  onChange={(e) =>
                    setAddUserId(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                >
                  <option value="">メンバーを選択</option>
                  {addableOrgMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.username}（{m.email}）
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">ロール</label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddToPending}
                disabled={addUserId === ""}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                リストに追加
              </button>
            </div>

            {/* 追加予定リスト */}
            {pendingMembers.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-gray-500">
                  追加予定（{pendingMembers.length} 件）
                </p>
                <ul className="flex flex-col gap-1">
                  {pendingMembers.map((p) => (
                    <li
                      key={p.userId}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm"
                    >
                      <span className="font-medium">{p.username}</span>
                      <span className="text-gray-500 dark:text-gray-400 flex-1 truncate">
                        {p.email}
                      </span>
                      <span className="text-gray-600 dark:text-gray-300 shrink-0">
                        {ROLE_LABELS[p.role]}
                      </span>
                      {/* 追加予定リストから取り除くボタン */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromPending(p.userId)}
                        className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                        aria-label={`${p.username} を追加予定から外す`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {addError && <p className="text-sm text-red-500">{addError}</p>}

            {/* 一括追加ボタン */}
            <button
              type="button"
              onClick={handleSubmitAddMembers}
              disabled={isAdding || pendingMembers.length === 0}
              className="w-full px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isAdding
                ? "追加中..."
                : `グループに追加${pendingMembers.length > 0 ? `（${pendingMembers.length} 件）` : ""}`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
