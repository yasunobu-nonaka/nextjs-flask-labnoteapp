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
 * GroupListModal コンポーネント
 * 所属グループと未所属グループをセクション分けして表示する。
 *
 * - 所属グループはリンク一覧として表示し、クリックでグループページへ遷移する。
 * - 未所属グループは join_method に応じて以下のいずれかを表示する:
 *     - "invite_only": 「招待制」バッジのみ（申請不可）
 *     - "request": 「参加を申請する」ボタン → 申請後は「申請をキャンセル」に切り替え
 *     - "open": 「グループに参加」ボタン → 即時参加して onImmediateJoin を呼ぶ
 * - unjoinedGroups に join_status === "pending" のグループがある場合、
 *   初期状態を「申請済み」として joinStatusMap を初期化する（ページリロード後の復元）。
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
  /** 即時参加が完了したとき呼ばれる。親がグループリストを更新し、モーダルを閉じてページ遷移する。 */
  onImmediateJoin: (groupId: number) => void;
  /** 参加申請のキャンセルが完了したとき呼ばれる。親が join_status を null にリセットする。 */
  onCancelledRequest: (groupId: number) => void;
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
        // 即時参加: 親に通知してモーダルを閉じ、グループページへ遷移する
        onImmediateJoin(groupId);
      } else {
        // 申請送信: ボタンを「申請済み」状態にする
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
      // キャンセル成功: 申請前の状態に戻し、親のグループリストも更新する
      setJoinStatusMap((prev) => new Map(prev).set(groupId, "idle"));
      onCancelledRequest(groupId);
    } catch {
      setJoinStatusMap((prev) => new Map(prev).set(groupId, "requested"));
      setJoinErrorMap((prev) =>
        new Map(prev).set(groupId, "サーバーへの接続に失敗しました"),
      );
    }
  }

  if (!isOpen) return null;

  return (
    <Modal title="グループ一覧" onClose={onClose}>
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
                    onClick={onClose}
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
                      {GROUP_ROLE_LABELS[group.role!] ?? group.role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 未所属グループ */}
        {unjoinedGroups.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">未所属グループ</h2>
            <ul className="flex flex-col gap-2">
              {unjoinedGroups.map((group) => {
                const joinMethod =
                  group.policy?.join_method ?? "invite_only";
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
                        ) : status === "requested" ||
                          status === "canceling" ? (
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
                      {/* エラーメッセージ */}
                      {error && (
                        <p className="text-xs text-red-500">{error}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {joinedGroups.length === 0 && unjoinedGroups.length === 0 && (
          <p className="text-gray-500 text-base">グループがありません。</p>
        )}
      </div>
    </Modal>
  );
}
