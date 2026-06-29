"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import GroupCreateModal from "@/components/GroupCreateModal";
import { type Group } from "@/components/GroupListModal";
import { GROUP_ROLE_LABELS } from "@/lib/constants";

/** 未所属グループごとの参加処理状態 */
type JoinStatus = "idle" | "requesting" | "requested" | "canceling";

/**
 * グループ一覧ページ。
 *
 * 所属グループと参加可能な公開グループを並べて表示する。
 * - 所属グループ: クリックでそのグループのノート一覧へ遷移する
 * - 未所属公開グループ: join_method に応じて参加ボタンを表示する
 *   - open         → 即時参加 → ノート一覧へ遷移
 *   - request      → 申請送信 → 「申請済み」+ キャンセルボタン
 *   - invite_only  → 「招待制」バッジのみ（操作不可）
 * - 「グループを作成」ボタン → GroupCreateModal → 作成後にノート一覧へ遷移
 */
export default function GroupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  /* 未所属グループごとの参加申請状態 */
  const [joinStatusMap, setJoinStatusMap] = useState<Map<number, JoinStatus>>(
    new Map(),
  );
  const [joinErrorMap, setJoinErrorMap] = useState<Map<number, string>>(
    new Map(),
  );

  /* 所属グループ / 公開未所属グループ */
  const joinedGroups = groups.filter((g) => g.role !== null);
  const unjoinedPublicGroups = groups.filter(
    (g) => !g.is_private && g.role === null,
  );

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/groups`);
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.status === 404) {
          setIsNotFound(true);
          return;
        }
        if (!res.ok) {
          router.replace("/organizations");
          return;
        }
        const data: Group[] = await res.json();
        setGroups(data);
        /* API の join_status=pending をローカル状態に反映する（リロード後の復元） */
        const initialJoinMap = new Map<number, JoinStatus>();
        data.forEach((g) => {
          if (g.join_status === "pending") {
            initialJoinMap.set(g.id, "requested");
          }
        });
        setJoinStatusMap(initialJoinMap);
      } catch {
        router.replace("/organizations");
      } finally {
        setIsLoading(false);
      }
    }
    fetchGroups();
  }, [orgId, router]);

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
        /* 即時参加: そのグループのノート一覧へ遷移する */
        router.push(`/organizations/${orgId}/groups/${groupId}/notes`);
      } else {
        /* 申請送信: ボタンを「申請済み」状態にする */
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
    } catch {
      setJoinStatusMap((prev) => new Map(prev).set(groupId, "requested"));
      setJoinErrorMap((prev) =>
        new Map(prev).set(groupId, "サーバーへの接続に失敗しました"),
      );
    }
  }

  if (isNotFound) {
    notFound();
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-16 flex flex-col gap-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold">グループ一覧</h1>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="shrink-0 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            グループを作成
          </button>
        </div>

        {/* 所属グループ */}
        {joinedGroups.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              所属グループ
            </h2>
            <ul className="flex flex-col gap-2">
              {joinedGroups.map((group) => (
                <li key={group.id}>
                  <Link
                    href={`/organizations/${orgId}/groups/${group.id}/notes`}
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

        {/* 参加可能なグループ */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            参加可能なグループ
          </h2>
          {unjoinedPublicGroups.length === 0 ? (
            <p className="text-sm text-gray-400">
              参加可能なグループがありません。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {unjoinedPublicGroups.map((group) => {
                const joinMethod = group.policy?.join_method ?? "invite_only";
                const status = joinStatusMap.get(group.id) ?? "idle";
                const error = joinErrorMap.get(group.id);
                return (
                  <li key={group.id}>
                    <div className="flex flex-col gap-1 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-medium">
                          {group.name}
                        </span>
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
                      {error && (
                        <p className="text-xs text-red-500">{error}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* グループ作成モーダル */}
      <GroupCreateModal
        orgId={orgId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(group) =>
          router.push(`/organizations/${orgId}/groups/${group.id}/notes`)
        }
      />
    </main>
  );
}
