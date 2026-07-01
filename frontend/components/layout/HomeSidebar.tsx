"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { authFetch } from "@/lib/api";
import OrgCreateModal from "@/components/org/OrgCreateModal";
import GroupCreateModal from "@/components/group/GroupCreateModal";
import GroupListModal, { type Group } from "@/components/group/GroupListModal";

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
 * 所属組織の一覧を表示し、組織が選択されている場合はそのグループ一覧も表示する。
 * 「作成」ボタンから組織・グループを作成でき、「一覧」ボタンでグループ一覧モーダルを開ける。
 */
export default function HomeSidebar({ selectedOrgId }: Props = {}) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isOrgCreateModalOpen, setIsOrgCreateModalOpen] = useState(false);
  const [isGroupCreateModalOpen, setIsGroupCreateModalOpen] = useState(false);
  const [isGroupListModalOpen, setIsGroupListModalOpen] = useState(false);
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
    if (!selectedOrgId) {
      setGroups([]);
      return;
    }
    async function fetchGroups() {
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

  // サイドバーには所属グループのみ表示する
  const joinedGroups = groups.filter((g) => g.role !== null);
  const unjoinedGroups = groups.filter((g) => g.role === null);

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
          {/* 組織作成ボタン */}
          <button
            onClick={() => setIsOrgCreateModalOpen(true)}
            className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
          >
            作成
          </button>
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
                    "flex items-center gap-0.5 rounded-lg transition-colors",
                    isSelected
                      ? "bg-gray-300 dark:bg-gray-600"
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
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
                  {/* ⚙ アイコン: owner / sys_admin / user_admin のみ表示する */}
                  {canManageOrg && (
                    <Link
                      href={`/organizations/${org.id}/admin`}
                      className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-1 rounded text-lg"
                      title={`${org.name} の管理`}
                    >
                      ⚙
                    </Link>
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
            <div className="flex items-center gap-1">
              {/* グループ作成ボタン */}
              <button
                onClick={() => setIsGroupCreateModalOpen(true)}
                className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
              >
                作成
              </button>
              {/* グループ一覧モーダルを開くボタン */}
              <button
                onClick={() => setIsGroupListModalOpen(true)}
                className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
              >
                一覧
              </button>
            </div>
          </div>

          {joinedGroups.length > 0 ? (
            /* 所属グループのリスト: ノート一覧ページへリンクする */
            <div className="flex flex-col gap-1.5 px-2">
              {joinedGroups.map((group) => (
                <Link
                  key={group.id}
                  href={`/organizations/${selectedOrgId}/groups/${group.id}/notes`}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="truncate text-base">{group.name}</span>
                  {group.is_private && (
                    <span className="shrink-0 text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                      非公開
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="px-2 text-sm text-gray-400 dark:text-gray-500">
              グループがありません
            </p>
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

      {/* グループ一覧モーダル: 未所属グループの参加もここから行う */}
      {selectedOrgId && (
        <GroupListModal
          orgId={selectedOrgId}
          isOpen={isGroupListModalOpen}
          onClose={() => setIsGroupListModalOpen(false)}
          joinedGroups={joinedGroups}
          unjoinedGroups={unjoinedGroups}
          onImmediateJoin={(groupId) => {
            setGroups((prev) =>
              prev.map((g) =>
                g.id === groupId ? { ...g, role: "editor", join_status: "active" } : g,
              ),
            );
            setIsGroupListModalOpen(false);
            router.push(`/organizations/${selectedOrgId}/groups/${groupId}/notes`);
          }}
          onCancelledRequest={(groupId) => {
            setGroups((prev) =>
              prev.map((g) =>
                g.id === groupId ? { ...g, join_status: null } : g,
              ),
            );
          }}
        />
      )}
    </aside>
  );
}
