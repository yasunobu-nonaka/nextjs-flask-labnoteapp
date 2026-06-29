"use client";

import { useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import Modal from "@/components/Modal";
import { GROUP_ROLE_LABELS } from "@/lib/constants";

export type Group = {
  id: number;
  name: string;
  is_private: boolean;
  role: string | null;
  /** APIから返される参加ステータス: "active" | "pending" | null */
  join_status: "active" | "pending" | null;
  policy: {
    join_method: string;
    allow_private_notes: boolean;
    is_notes_visible_to_org: boolean;
  } | null;
};

/** 未所属グループごとの参加処理状態 */
type JoinStatus = "idle" | "requesting" | "requested" | "canceling";

/**
 * グループ一覧の中身コンポーネント。
 * モーダル内でもページ上でもそのまま使える。
 *
 * - 所属グループ: リンク一覧。クリック時に onJoinedGroupClick を呼ぶ（例: モーダルを閉じる）。
 * - 未所属グループ: join_method に応じてボタンを切り替える。
 *     - "open":         即時参加 → onImmediateJoin を呼ぶ
 *     - "request":      申請送信 → 「申請済み」+ キャンセルボタン
 *     - "invite_only":  「招待制」バッジのみ
 * - unjoinedGroups が空のとき unjoinedEmptyText が指定されていれば空メッセージを表示する。
 * - unjoinedGroups に join_status === "pending" のグループがある場合、
 *   初期状態を「申請済み」として joinStatusMap を初期化する（リロード後の復元）。
 */
export function GroupList({
  orgId,
  joinedGroups,
  unjoinedGroups,
  onImmediateJoin,
  onCancelledRequest,
  onJoinedGroupClick,
  unjoinedEmptyText,
}: {
  orgId: string;
  joinedGroups: Group[];
  unjoinedGroups: Group[];
  /** 即時参加が完了したとき呼ばれる */
  onImmediateJoin: (groupId: number) => void;
  /** 参加申請のキャンセルが完了したとき呼ばれる */
  onCancelledRequest: (groupId: number) => void;
  /** 所属グループのリンクをクリックしたとき呼ばれる（モーダルを閉じるなど） */
  onJoinedGroupClick?: () => void;
  /** 未所属グループが 0 件のとき表示するテキスト。未指定の場合はセクション自体を非表示にする */
  unjoinedEmptyText?: string;
}) {
  // unjoinedGroups の pending 状態を初期値として反映する（lazy initializer）
  const [joinStatusMap, setJoinStatusMap] = useState<Map<number, JoinStatus>>(
    () => {
      const m = new Map<number, JoinStatus>();
      unjoinedGroups.forEach((g) => {
        if (g.join_status === "pending") {
          m.set(g.id, "requested");
        }
      });
      return m;
    },
  );
  const [joinErrorMap, setJoinErrorMap] = useState<Map<number, string>>(
    new Map(),
  );

  /** グループへの参加申請または即時参加を行う */
  async function handleJoin(groupId: number) {
    setJoinStatusMap((prev) => new Map(prev).set(groupId, "requesting"));
    setJoinErrorMap((prev) => {
      const m = new Map(prev);
      m.delete(groupId);
      return m;
    });
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}/join`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setJoinStatusMap((prev) => new Map(prev).set(groupId, "idle"));
        setJoinErrorMap((prev) =>
          new Map(prev).set(groupId, data.message ?? "参加に失敗しました"),
        );
        return;
      }
      if (data.result === "joined") {
        onImmediateJoin(groupId);
      } else {
        setJoinStatusMap((prev) => new Map(prev).set(groupId, "requested"));
      }
    } catch {
      setJoinStatusMap((prev) => new Map(prev).set(groupId, "idle"));
      setJoinErrorMap((prev) =>
        new Map(prev).set(groupId, "サーバーへの接続に失敗しました"),
      );
    }
  }

  /** グループへの参加申請をキャンセルする */
  async function handleCancelJoin(groupId: number) {
    setJoinStatusMap((prev) => new Map(prev).set(groupId, "canceling"));
    setJoinErrorMap((prev) => {
      const m = new Map(prev);
      m.delete(groupId);
      return m;
    });
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}/join`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setJoinStatusMap((prev) => new Map(prev).set(groupId, "requested"));
        setJoinErrorMap((prev) =>
          new Map(prev).set(
            groupId,
            data.message ?? "キャンセルに失敗しました",
          ),
        );
        return;
      }
      setJoinStatusMap((prev) => new Map(prev).set(groupId, "idle"));
      onCancelledRequest(groupId);
    } catch {
      setJoinStatusMap((prev) => new Map(prev).set(groupId, "requested"));
      setJoinErrorMap((prev) =>
        new Map(prev).set(groupId, "サーバーへの接続に失敗しました"),
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 所属グループ */}
      {joinedGroups.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">所属グループ</h2>
          <ul className="flex flex-col gap-2">
            {joinedGroups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/organizations/${orgId}/groups/${group.id}/notes`}
                  onClick={onJoinedGroupClick}
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
                  <span className="text-sm text-gray-400">
                    {GROUP_ROLE_LABELS[group.role!] ?? group.role}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 未所属グループ */}
      {unjoinedGroups.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">未所属グループ</h2>
          <ul className="flex flex-col gap-2">
            {unjoinedGroups.map((group) => {
              const joinMethod = group.policy?.join_method ?? "invite_only";
              const status = joinStatusMap.get(group.id) ?? "idle";
              const error = joinErrorMap.get(group.id);
              return (
                <li key={group.id}>
                  <div className="flex flex-col gap-1 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                    <div className="flex items-center justify-between">
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
                      {/* join_method に応じてボタンを切り替える */}
                      {joinMethod === "invite_only" ? (
                        <span className="text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-2 py-1">
                          招待制
                        </span>
                      ) : status === "requested" || status === "canceling" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-green-600 dark:text-green-400">
                            ✓ 申請済み
                          </span>
                          <button
                            type="button"
                            disabled={status === "canceling"}
                            onClick={() => handleCancelJoin(group.id)}
                            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {status === "canceling"
                              ? "キャンセル中..."
                              : "申請をキャンセル"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={status === "requesting"}
                          onClick={() => handleJoin(group.id)}
                          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {status === "requesting"
                            ? "処理中..."
                            : joinMethod === "open"
                              ? "グループに参加"
                              : "参加を申請する"}
                        </button>
                      )}
                    </div>
                    {error && <p className="text-xs text-red-500">{error}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : unjoinedEmptyText ? (
        <p className="text-sm text-gray-400">{unjoinedEmptyText}</p>
      ) : null}

      {joinedGroups.length === 0 && unjoinedGroups.length === 0 && !unjoinedEmptyText && (
        <p className="text-gray-500 text-base">グループがありません。</p>
      )}
    </div>
  );
}

/**
 * GroupListModal コンポーネント
 * GroupList をモーダル内に表示する薄いラッパー。
 */
export default function GroupListModal({
  orgId,
  isOpen,
  onClose,
  joinedGroups,
  unjoinedGroups,
  onImmediateJoin,
  onCancelledRequest,
}: {
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
  joinedGroups: Group[];
  unjoinedGroups: Group[];
  onImmediateJoin: (groupId: number) => void;
  onCancelledRequest: (groupId: number) => void;
}) {
  if (!isOpen) return null;

  return (
    <Modal title="グループ一覧" onClose={onClose}>
      <GroupList
        orgId={orgId}
        joinedGroups={joinedGroups}
        unjoinedGroups={unjoinedGroups}
        onImmediateJoin={onImmediateJoin}
        onCancelledRequest={onCancelledRequest}
        onJoinedGroupClick={onClose}
      />
    </Modal>
  );
}
