"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import GroupCreateModal from "@/components/group/GroupCreateModal";
import { GroupList, type Group } from "@/components/group/GroupListModal";
import AppHeader from "@/components/layout/AppHeader";
import HomeSidebar from "@/components/layout/HomeSidebar";

/**
 * グループ一覧ページ。
 * HomeSidebar を左に表示し、現在の組織をハイライトする。
 * 右エリアでグループ一覧を表示する:
 *   - グループがない場合: 作成を促す空状態
 *   - グループがある場合: 所属グループと参加可能な公開グループを一覧表示
 */
export default function GroupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [orgName, setOrgName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const joinedGroups = groups.filter((g) => g.role !== null);
  const unjoinedPublicGroups = groups.filter(
    (g) => !g.is_private && g.role === null,
  );
  const hasNoGroups = !isLoading && joinedGroups.length === 0 && unjoinedPublicGroups.length === 0;

  useEffect(() => {
    async function fetchData() {
      try {
        // 組織名の取得
        const orgRes = await authFetch(`/api/organizations/${orgId}`);
        if (orgRes.status === 401) {
          router.replace("/login");
          return;
        }
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          setOrgName(orgData.name ?? "");
        }

        // グループ一覧の取得
        const groupsRes = await authFetch(`/api/organizations/${orgId}/groups`);
        if (groupsRes.status === 401) {
          router.replace("/login");
          return;
        }
        if (groupsRes.status === 404) {
          setIsNotFound(true);
          return;
        }
        if (!groupsRes.ok) {
          router.replace("/organizations");
          return;
        }
        setGroups(await groupsRes.json());
      } catch {
        router.replace("/organizations");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [orgId, router]);

  if (isNotFound) {
    notFound();
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground flex">
      {/* 左カラム: 現在の組織をハイライトした組織ナビゲーションサイドバー */}
      <HomeSidebar selectedOrgId={orgId} />

      {/* 右カラム: ヘッダー + グループ一覧コンテンツ */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader showLogo={false} />

        <div className="flex-1 overflow-y-auto px-6 py-10">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 text-base">読み込み中...</p>
            </div>
          ) : hasNoGroups ? (
            /* グループがない場合: 作成を促す空状態 */
            <div className="flex flex-col items-center gap-6 py-20 text-center">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">グループを作成しましょう</h1>
                <p className="text-gray-500 text-base">
                  {orgName} にはまだグループがありません。
                  グループを作成してメンバーを招待し、ノートを共有しましょう。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity"
              >
                グループを作成する
              </button>
            </div>
          ) : (
            /* グループがある場合: 一覧表示 */
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-lg font-semibold">
                  {orgName ? `${orgName} のグループ` : "グループ一覧"}
                </h1>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="shrink-0 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity"
                >
                  グループを作成
                </button>
              </div>

              <GroupList
                orgId={orgId}
                joinedGroups={joinedGroups}
                unjoinedGroups={unjoinedPublicGroups}
                onImmediateJoin={(groupId) =>
                  router.push(`/organizations/${orgId}/groups/${groupId}/notes`)
                }
                onCancelledRequest={(groupId) =>
                  setGroups((prev) =>
                    prev.map((g) =>
                      g.id === groupId ? { ...g, join_status: null } : g,
                    ),
                  )
                }
              />
            </div>
          )}
        </div>
      </div>

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
