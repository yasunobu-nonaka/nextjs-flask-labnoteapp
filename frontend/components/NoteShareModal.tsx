"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import Modal from "@/components/Modal";
import { type PrivateMember } from "@/components/NoteCard";
import { GROUP_ROLE_LABELS } from "@/lib/constants";

/** グループメンバー（招待先候補として取得するもの） */
type GroupMember = {
  user_id: number;
  username: string;
  role: string;
};

/**
 * NoteShareModal コンポーネント
 * プライベートノートを任意のグループメンバーと共有するためのモーダル。
 * オーナーのみ操作できる。グループメンバー一覧から招待先を選択し、
 * editor / viewer ロールを付与して共有する。
 * 既存の共有メンバー一覧と削除も同モーダル内で行う。
 */
export default function NoteShareModal({
  isOpen,
  onClose,
  noteId,
  orgId,
  groupId,
  notesBase,
  privateMembers,
  onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  noteId: number;
  orgId: number;
  groupId: number;
  notesBase: string;
  privateMembers: PrivateMember[];
  onUpdated: (members: PrivateMember[]) => void;
}) {
  // グループメンバー一覧（招待候補）
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  // 招待先ユーザーの選択値
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  // 招待するロール
  const [selectedRole, setSelectedRole] = useState<"editor" | "viewer">("editor");
  // モーダル内エラー
  const [error, setError] = useState<string | null>(null);
  // 追加中フラグ
  const [isAdding, setIsAdding] = useState(false);
  // ロール変更中のユーザーID（複数同時操作防止）
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<number | null>(null);
  // 現在のメンバー一覧（親から受け取り、操作のたびに更新）
  const [members, setMembers] = useState<PrivateMember[]>(privateMembers);

  const membersApiBase = `/api/organizations/${orgId}/groups/${groupId}/notes/${noteId}/members`;

  // モーダルを開いたときにグループメンバー一覧を取得する
  useEffect(() => {
    if (!isOpen) return;
    setMembers(privateMembers);
    setSelectedUserId("");
    setError(null);

    async function fetchGroupMembers() {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}/members`,
      );
      if (res.ok) {
        const data: GroupMember[] = await res.json();
        setGroupMembers(data);
      }
    }
    fetchGroupMembers();
  }, [isOpen, orgId, groupId, privateMembers]);

  // 既に共有済みの user_id のセット（ドロップダウンの絞り込みに使う）
  const sharedUserIds = new Set(members.map((m) => m.user_id));

  // オーナー自身を含む共有済みユーザーを除いたグループメンバーを招待候補とする
  const candidates = groupMembers.filter((m) => !sharedUserIds.has(m.user_id));

  async function handleAdd() {
    if (!selectedUserId) return;
    setIsAdding(true);
    setError(null);
    const res = await authFetch(membersApiBase, {
      method: "POST",
      body: JSON.stringify({ user_id: selectedUserId, role: selectedRole }),
    });
    if (res.ok) {
      const data = await res.json();
      const newMember: PrivateMember = data.member;
      const updated = [...members, newMember];
      setMembers(updated);
      onUpdated(updated);
      setSelectedUserId("");
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? "追加に失敗しました");
    }
    setIsAdding(false);
  }

  async function handleRoleChange(targetUserId: number, newRole: "editor" | "viewer") {
    setUpdatingRoleUserId(targetUserId);
    setError(null);
    const res = await authFetch(`${membersApiBase}/${targetUserId}`, {
      method: "PATCH",
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      const updated = members.map((m) =>
        m.user_id === targetUserId ? { ...m, role: newRole } : m,
      );
      setMembers(updated);
      onUpdated(updated);
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? "ロールの変更に失敗しました");
    }
    setUpdatingRoleUserId(null);
  }

  async function handleRemove(targetUserId: number) {
    const res = await authFetch(`${membersApiBase}/${targetUserId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const updated = members.filter((m) => m.user_id !== targetUserId);
      setMembers(updated);
      onUpdated(updated);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal title="ノートを共有" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {/* 現在の共有メンバー一覧 */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            共有中のメンバー
          </p>
          {members.length === 0 ? (
            <p className="text-sm text-gray-400">まだ共有していません</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-base"
                >
                  <span className="font-medium">{m.username}</span>
                  <div className="flex items-center gap-2">
                    {/* owner はロール変更・削除不可 */}
                    {m.role === "owner" ? (
                      <span className="text-gray-400 text-base">オーナー</span>
                    ) : (
                      <>
                        {/* ロール変更セレクタ */}
                        <select
                          value={m.role}
                          disabled={updatingRoleUserId === m.user_id}
                          onChange={(e) =>
                            handleRoleChange(m.user_id, e.target.value as "editor" | "viewer")
                          }
                          className="px-2 py-1 text-base border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50"
                        >
                          <option value="editor">編集者</option>
                          <option value="viewer">閲覧者</option>
                        </select>
                        <button
                          onClick={() => handleRemove(m.user_id)}
                          className="text-red-500 hover:text-red-700 text-base underline"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* メンバー追加フォーム */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            メンバーを追加
          </p>
          <div className="flex gap-2">
            {/* 招待先ユーザー選択 */}
            <select
              value={selectedUserId}
              onChange={(e) =>
                setSelectedUserId(e.target.value ? Number(e.target.value) : "")
              }
              className="flex-1 px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="">ユーザーを選択</option>
              {candidates.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.username}（{GROUP_ROLE_LABELS[m.role] ?? m.role}）
                </option>
              ))}
            </select>
            {/* ロール選択 */}
            <select
              value={selectedRole}
              onChange={(e) =>
                setSelectedRole(e.target.value as "editor" | "viewer")
              }
              className="w-28 px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="editor">編集者</option>
              <option value="viewer">閲覧者</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-between items-center gap-2">
            {/* 共有済みノートへのリンク（共有相手に直接 URL を知らせる用途） */}
            <a
              href={`${notesBase}/${noteId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 underline"
            >
              ノートを開く
            </a>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!selectedUserId || isAdding}
                className="px-4 py-2 text-base rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {isAdding ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
