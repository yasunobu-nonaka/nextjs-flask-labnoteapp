"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { authFetch } from "@/lib/api";
import OrgCreateModal from "@/components/org/OrgCreateModal";
import OrgSwitchModal from "@/components/org/OrgSwitchModal";
import GroupCreateModal from "@/components/group/GroupCreateModal";
import { type Group } from "@/components/group/GroupListModal";

type Org = {
  id: number;
  name: string;
  role: string;
};

type Props = {
  /** 現在選択中の組織 ID。一致する組織をハイライト表示し、グループ一覧を表示する。 */
  selectedOrgId?: string;
};

/**
 * HomeSidebar コンポーネント
 * ホーム・組織・グループページ共通の左サイドバー。
 * 所属組織の一覧を表示し、組織が選択されている場合はそのグループ一覧（所属・未所属を問わず全件）も表示する。
 * 未所属グループは join_method に応じて参加ボタン（即時参加/申請）または「招待制」バッジを出し分ける。
 * グループ作成は「作成」ボタンから行う（一覧モーダルは廃止）。
 */
export default function HomeSidebar({ selectedOrgId }: Props = {}) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isOrgCreateModalOpen, setIsOrgCreateModalOpen] = useState(false);
  const [isOrgSwitchModalOpen, setIsOrgSwitchModalOpen] = useState(false);
  const [isGroupCreateModalOpen, setIsGroupCreateModalOpen] = useState(false);
  // 未所属グループの参加処理状態（グループ ID ごと）
  const [joinStatusMap, setJoinStatusMap] = useState<
    Map<number, "idle" | "requesting" | "requested" | "canceling">
  >(new Map());
  const [joinErrorMap, setJoinErrorMap] = useState<Map<number, string>>(
    new Map(),
  );
  // 組織の ⋮ 管理メニューポップオーバーを開いている組織の ID とその表示位置
  const [openOrgAdminMenuId, setOpenOrgAdminMenuId] = useState<number | null>(
    null,
  );
  const [orgAdminMenuPosition, setOrgAdminMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  // グループの ⋮ 管理メニューポップオーバーを開いているグループの ID とその表示位置
  const [openGroupAdminMenuId, setOpenGroupAdminMenuId] = useState<
    number | null
  >(null);
  const [groupAdminMenuPosition, setGroupAdminMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await authFetch("/api/organizations");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          setOrgs(await res.json());
        }
      } catch (err) {
        console.error("組織一覧の取得に失敗しました", err);
      }
    }
    fetchOrgs();
  }, [router]);

  // 選択中の組織が変わるたびにグループ一覧を取得する
  useEffect(() => {
    async function fetchGroups() {
      if (!selectedOrgId) {
        setGroups([]);
        return;
      }
      try {
        const res = await authFetch(`/api/organizations/${selectedOrgId}/groups`);
        if (res.ok) {
          setGroups(await res.json());
        }
      } catch (err) {
        console.error("グループ一覧の取得に失敗しました", err);
      }
    }
    fetchGroups();
  }, [selectedOrgId]);

  // グループへの参加申請または即時参加を行う
  async function handleJoinGroup(targetGroupId: number) {
    if (!selectedOrgId) return;
    setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "requesting"));
    setJoinErrorMap((prev) => {
      const m = new Map(prev);
      m.delete(targetGroupId);
      return m;
    });
    try {
      const res = await authFetch(
        `/api/organizations/${selectedOrgId}/groups/${targetGroupId}/join`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "idle"));
        setJoinErrorMap((prev) =>
          new Map(prev).set(targetGroupId, data.message ?? "参加に失敗しました"),
        );
        return;
      }
      if (data.result === "joined") {
        // 即時参加: 一覧を更新してそのグループのノート一覧へ遷移する
        setGroups((prev) =>
          prev.map((g) =>
            g.id === targetGroupId
              ? { ...g, role: "editor", join_status: "active" }
              : g,
          ),
        );
        router.push(`/organizations/${selectedOrgId}/groups/${targetGroupId}/notes`);
      } else {
        setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "requested"));
      }
    } catch {
      setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "idle"));
      setJoinErrorMap((prev) =>
        new Map(prev).set(targetGroupId, "サーバーへの接続に失敗しました"),
      );
    }
  }

  // グループへの参加申請をキャンセルする
  async function handleCancelJoinGroup(targetGroupId: number) {
    if (!selectedOrgId) return;
    setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "canceling"));
    setJoinErrorMap((prev) => {
      const m = new Map(prev);
      m.delete(targetGroupId);
      return m;
    });
    try {
      const res = await authFetch(
        `/api/organizations/${selectedOrgId}/groups/${targetGroupId}/join`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "requested"));
        setJoinErrorMap((prev) =>
          new Map(prev).set(
            targetGroupId,
            data.message ?? "キャンセルに失敗しました",
          ),
        );
        return;
      }
      setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "idle"));
      setGroups((prev) =>
        prev.map((g) =>
          g.id === targetGroupId ? { ...g, join_status: null } : g,
        ),
      );
    } catch {
      setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "requested"));
      setJoinErrorMap((prev) =>
        new Map(prev).set(targetGroupId, "サーバーへの接続に失敗しました"),
      );
    }
  }

  // 所属・未所属を問わず全グループを表示する
  const joinedGroups = groups.filter((g) => g.role !== null);
  const unjoinedGroups = groups.filter((g) => g.role === null);

  // 選択中の組織ロール（グループ管理リンクの表示判定に使う）
  const selectedOrgRole = orgs.find((o) => String(o.id) === selectedOrgId)?.role ?? null;

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 pt-4 pb-6 px-3 flex flex-col gap-4">
      {/* アプリロゴ: クリックすると /organizations へ戻る */}
      <div className="h-12 flex items-center px-2 pt-2 shrink-0">
        <Link
          href="/organizations"
          className="text-2xl font-bold tracking-tight hover:opacity-75 transition-opacity"
        >
          LabNoteApp
        </Link>
      </div>

      {/* 組織一覧セクション */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2">
          <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            組織
          </span>
          <div className="flex items-center gap-1">
            {/* 組織切り替えボタン: 組織作成はこのモーダル右上の「作成」ボタンから行う */}
            <button
              onClick={() => setIsOrgSwitchModalOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
            >
              切り替え
            </button>
          </div>
        </div>

        {orgs.length > 0 ? (
          <div className="flex flex-col gap-1.5 px-2">
            {orgs.map((org) => {
              const isSelected = String(org.id) === selectedOrgId;
              const canManageOrg = ["owner", "sys_admin", "user_admin"].includes(org.role);
              return (
                <div
                  key={org.id}
                  className={clsx(
                    "group flex items-center gap-0.5 rounded-lg transition-colors",
                    isSelected
                      ? "bg-gray-300 dark:bg-gray-600"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700",
                  )}
                >
                  {/* 組織名: グループ一覧ページへのリンク */}
                  <Link
                    href={`/organizations/${org.id}/groups`}
                    className={clsx(
                      "flex-1 flex items-center px-2 py-1.5 min-w-0",
                      isSelected && "font-semibold",
                    )}
                  >
                    <span className="truncate text-base">{org.name}</span>
                  </Link>
                  {/* ⋮ 管理メニュー: owner / sys_admin / user_admin のみ、行にホバーしたときだけ表示する */}
                  {canManageOrg && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openOrgAdminMenuId === org.id) {
                          setOpenOrgAdminMenuId(null);
                          return;
                        }
                        const rect = e.currentTarget.getBoundingClientRect();
                        setOrgAdminMenuPosition({
                          top: rect.top,
                          left: rect.right + 4,
                        });
                        setOpenOrgAdminMenuId(org.id);
                      }}
                      className={clsx(
                        "shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-1 rounded text-lg leading-none group-hover:opacity-100",
                        openOrgAdminMenuId === org.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                      title={`${org.name} の管理`}
                    >
                      ⋮
                    </button>
                  )}

                  {/* 組織管理メニューポップオーバー: <aside> の overflow-y-auto によるクリッピングを避けるため document.body にポータルする */}
                  {openOrgAdminMenuId === org.id &&
                    orgAdminMenuPosition &&
                    createPortal(
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenOrgAdminMenuId(null)}
                        />
                        <div
                          className="fixed z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-max"
                          style={{
                            top: orgAdminMenuPosition.top,
                            left: orgAdminMenuPosition.left,
                          }}
                        >
                          <Link
                            href={`/organizations/${org.id}/admin`}
                            onClick={() => setOpenOrgAdminMenuId(null)}
                            className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            基本設定
                          </Link>
                          <Link
                            href={`/organizations/${org.id}/admin/groups`}
                            onClick={() => setOpenOrgAdminMenuId(null)}
                            className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            グループ管理
                          </Link>
                          <Link
                            href={`/organizations/${org.id}/admin/members`}
                            onClick={() => setOpenOrgAdminMenuId(null)}
                            className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            メンバー管理
                          </Link>
                          <Link
                            href={`/organizations/${org.id}/admin/policy`}
                            onClick={() => setOpenOrgAdminMenuId(null)}
                            className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            ポリシー管理
                          </Link>
                        </div>
                      </>,
                      document.body,
                    )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-2 text-sm text-gray-400 dark:text-gray-500">
            まだ組織に所属していません
          </p>
        )}
      </div>

      {/* グループ一覧セクション: 組織が選択されている場合のみ表示する */}
      {selectedOrgId && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2">
            <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              グループ
            </span>
            {/* グループ作成ボタン */}
            <button
              onClick={() => setIsGroupCreateModalOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
            >
              作成
            </button>
          </div>

          {joinedGroups.length > 0 ? (
            /* 所属グループのリスト: ノート一覧ページへリンクする */
            <div className="flex flex-col gap-1.5 px-2">
              {joinedGroups.map((group) => {
                // グループ admin またはorganization の owner/sys_admin/user_admin なら管理画面リンクを表示する
                const canManageGroup =
                  group.role === "admin" ||
                  ["owner", "sys_admin", "user_admin"].includes(selectedOrgRole ?? "");
                return (
                  <div
                    key={group.id}
                    className="group flex items-center gap-0.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {/* グループ名: ノート一覧ページへのリンク */}
                    <Link
                      href={`/organizations/${selectedOrgId}/groups/${group.id}/notes`}
                      className="flex-1 flex items-center gap-1.5 px-2 py-1.5 min-w-0"
                    >
                      <span className="truncate text-base">{group.name}</span>
                      {group.is_private && (
                        <span className="shrink-0 text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                          非公開
                        </span>
                      )}
                    </Link>
                    {/* ⋮ 管理メニュー: グループ管理者または組織管理者のみ、行にホバーしたときだけ表示する */}
                    {canManageGroup && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openGroupAdminMenuId === group.id) {
                            setOpenGroupAdminMenuId(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setGroupAdminMenuPosition({
                            top: rect.top,
                            left: rect.right + 4,
                          });
                          setOpenGroupAdminMenuId(group.id);
                        }}
                        className={clsx(
                          "shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-1 rounded text-lg leading-none group-hover:opacity-100",
                          openGroupAdminMenuId === group.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                        title={`${group.name} の管理`}
                      >
                        ⋮
                      </button>
                    )}

                    {/* グループ管理メニューポップオーバー: document.body にポータルする */}
                    {openGroupAdminMenuId === group.id &&
                      groupAdminMenuPosition &&
                      createPortal(
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenGroupAdminMenuId(null)}
                          />
                          <div
                            className="fixed z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-max"
                            style={{
                              top: groupAdminMenuPosition.top,
                              left: groupAdminMenuPosition.left,
                            }}
                          >
                            <Link
                              href={`/organizations/${selectedOrgId}/groups/${group.id}/admin`}
                              onClick={() => setOpenGroupAdminMenuId(null)}
                              className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              基本設定
                            </Link>
                            <Link
                              href={`/organizations/${selectedOrgId}/groups/${group.id}/admin/members`}
                              onClick={() => setOpenGroupAdminMenuId(null)}
                              className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              メンバー管理
                            </Link>
                            <Link
                              href={`/organizations/${selectedOrgId}/groups/${group.id}/admin/policy`}
                              onClick={() => setOpenGroupAdminMenuId(null)}
                              className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              ポリシー管理
                            </Link>
                          </div>
                        </>,
                        document.body,
                      )}
                  </div>
                );
              })}
            </div>
          ) : unjoinedGroups.length === 0 ? (
            <p className="px-2 text-sm text-gray-400 dark:text-gray-500">
              グループがありません
            </p>
          ) : null}

          {/* 未所属グループ: join_method に応じて参加ボタン/招待制バッジを出し分ける */}
          {unjoinedGroups.length > 0 && (
            <div className="flex flex-col gap-1.5 px-2 mt-2">
              <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                未参加のグループ
              </span>
              {unjoinedGroups.map((group) => {
                const joinMethod = group.policy?.join_method ?? "invite_only";
                const status =
                  joinStatusMap.get(group.id) ??
                  (group.join_status === "pending" ? "requested" : "idle");
                const error = joinErrorMap.get(group.id);
                return (
                  <div key={group.id} className="flex flex-col gap-0.5 py-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 flex items-center gap-1.5 px-2 py-1 min-w-0">
                        <span className="truncate text-gray-500 dark:text-gray-400">
                          {group.name}
                        </span>
                        {group.is_private && (
                          <span className="shrink-0 text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                            非公開
                          </span>
                        )}
                      </div>
                      {joinMethod === "invite_only" ? (
                        <span className="shrink-0 text-xs text-gray-400 pr-2">
                          招待制
                        </span>
                      ) : status === "requested" || status === "canceling" ? (
                        <button
                          type="button"
                          disabled={status === "canceling"}
                          onClick={() => handleCancelJoinGroup(group.id)}
                          className="shrink-0 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors pr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {status === "canceling" ? "キャンセル中..." : "申請済み ×"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={status === "requesting"}
                          onClick={() => handleJoinGroup(group.id)}
                          className="shrink-0 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors pr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {status === "requesting"
                            ? "処理中..."
                            : joinMethod === "open"
                              ? "参加"
                              : "申請"}
                        </button>
                      )}
                    </div>
                    {error && (
                      <p className="px-2 text-xs text-red-500">{error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 組織作成モーダル */}
      <OrgCreateModal
        isOpen={isOrgCreateModalOpen}
        onClose={() => setIsOrgCreateModalOpen(false)}
        onCreated={(org) => {
          setIsOrgCreateModalOpen(false);
          router.push(`/organizations/${org.id}/groups`);
        }}
      />

      {/* 組織切り替えモーダル */}
      <OrgSwitchModal
        isOpen={isOrgSwitchModalOpen}
        onClose={() => setIsOrgSwitchModalOpen(false)}
        onCreateClick={() => {
          setIsOrgSwitchModalOpen(false);
          setIsOrgCreateModalOpen(true);
        }}
      />

      {/* グループ作成モーダル */}
      {selectedOrgId && (
        <GroupCreateModal
          orgId={selectedOrgId}
          isOpen={isGroupCreateModalOpen}
          onClose={() => setIsGroupCreateModalOpen(false)}
          onCreated={(group) => {
            setGroups((prev) => [
              ...prev,
              {
                id: group.id,
                name: group.name,
                is_private: false,
                role: "admin",
                join_status: "active",
                policy: null,
              },
            ]);
            setIsGroupCreateModalOpen(false);
            router.push(`/organizations/${selectedOrgId}/groups/${group.id}/notes`);
          }}
        />
      )}

    </aside>
  );
}
