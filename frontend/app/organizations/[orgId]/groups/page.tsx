"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import HomeSidebar from "@/components/layout/HomeSidebar";
import GroupCreateModal from "@/components/group/GroupCreateModal";
import { type Group } from "@/components/group/GroupListModal";

/**
 * グループ一覧ページ。
 * HomeSidebar がグループナビゲーションを担う。
 * 右エリアは参加済みグループの有無で表示を切り替える:
 *   - 参加済みグループなし → グループ作成を促す空状態
 *   - 参加済みグループあり → グループ未選択の案内メッセージ
 */
export default function GroupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [orgName, setOrgName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const hasJoinedGroups = groups.some((g) => g.role !== null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [orgRes, groupsRes] = await Promise.all([
          authFetch(`/api/organizations/${orgId}`),
          authFetch(`/api/organizations/${orgId}/groups`),
        ]);
        if (orgRes.status === 401) {
          router.replace("/login");
          return;
        }
        if (orgRes.ok) {
          const data = await orgRes.json();
          setOrgName(data.name ?? "");
        }
        if (groupsRes.ok) {
          setGroups(await groupsRes.json());
        }
      } catch {
        // エラーは空状態として扱う
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [orgId, router]);

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground flex">
      {/* 左カラム: 現在の組織をハイライトし、グループ一覧を表示するサイドバー */}
      <HomeSidebar selectedOrgId={orgId} />

      {/* 右カラム: ヘッダー + メインコンテンツ */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader showLogo={false} />
        <div className="flex-1 flex items-center justify-center">
          {isLoading ? (
            <p className="text-gray-500 text-base">読み込み中...</p>
          ) : !hasJoinedGroups ? (
            /* 参加済みグループがない場合: 作成を促す空状態 */
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">グループを作成しましょう</h1>
                <p className="text-gray-500 text-base">
                  {orgName && `${orgName} には`}まだ参加しているグループがありません。
                  グループを作成してメンバーを招待し、ノートを共有しましょう。
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity"
              >
                グループを作成する
              </button>
            </div>
          ) : (
            /* 参加済みグループがある場合: サイドバーから選択するよう案内する */
            <p className="text-gray-400 dark:text-gray-500 text-base">
              グループが選択されていません。左のサイドバーから選択してください。
            </p>
          )}
        </div>
      </div>

      {/* グループ作成モーダル: 空状態のボタンから開く */}
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
