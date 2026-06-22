"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

type GroupMember = {
  user_id: number;
  username: string;
  email: string;
  role: string;
  joined_at: string;
};

type OrgMember = {
  user_id: number;
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
 * メンバー追加は組織メンバー一覧から未参加のメンバーを選択して POST する。
 */
export default function GroupAdminMembersPage() {
  const { orgId, groupId } = useParams<{ orgId: string; groupId: string }>();
  const router = useRouter();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // user_id → 変更後のロール。変更があったメンバーのみ保持する
  const [pendingRoles, setPendingRoles] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // メンバー追加フォームの状態
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [addUserId, setAddUserId] = useState<number | "">("");
  const [addRole, setAddRole] = useState<string>("editor");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // マウント時にグループメンバーと組織メンバー一覧を並行取得する
  useEffect(() => {
    async function fetchData() {
      try {
        const [membersRes, orgMembersRes] = await Promise.all([
          authFetch(`/api/organizations/${orgId}/groups/${groupId}/members`),
          authFetch(`/api/organizations/${orgId}/members`),
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

  /** 選択した組織メンバーをグループに追加する */
  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (addUserId === "") return;

    setIsAdding(true);
    setAddError(null);
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}/members`,
        {
          method: "POST",
          body: JSON.stringify({ user_id: addUserId, role: addRole }),
        },
      );
      if (!res.ok) {
        const json = await res.json();
        setAddError(json.message ?? "追加に失敗しました");
        return;
      }
      const json = await res.json();
      // 追加したメンバーをリストに追加してフォームをリセットする
      setMembers((prev) => [...prev, json.member]);
      setAddUserId("");
      setAddRole("editor");
    } catch {
      setAddError("サーバーへの接続に失敗しました");
    } finally {
      setIsAdding(false);
    }
  }

  const hasPendingChanges = Object.keys(pendingRoles).length > 0;

  // 組織メンバーのうちまだグループに参加していないメンバーを抽出する
  const currentMemberIds = new Set(members.map((m) => m.user_id));
  const addableOrgMembers = orgMembers.filter(
    (m) => !currentMemberIds.has(m.user_id),
  );

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-2xl font-bold">メンバー管理</h2>

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

      {/* メンバー追加フォーム: 組織メンバーのうち未参加のメンバーを追加できる */}
      {!loading && !fetchError && addableOrgMembers.length > 0 && (
        <section className="flex flex-col gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold">メンバーを追加</h3>
          <form onSubmit={handleAddMember} className="flex gap-2 flex-wrap">
            {/* 追加するメンバーの選択 */}
            <select
              value={addUserId}
              onChange={(e) =>
                setAddUserId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="flex-1 min-w-48 px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="">メンバーを選択</option>
              {addableOrgMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.username}（{m.email}）
                </option>
              ))}
            </select>
            {/* 追加時のロール選択 */}
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
            <button
              type="submit"
              disabled={isAdding || addUserId === ""}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isAdding ? "追加中..." : "追加"}
            </button>
          </form>
          {addError && <p className="text-sm text-red-500">{addError}</p>}
        </section>
      )}
    </div>
  );
}
