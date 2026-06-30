"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import GroupCreateModal from "@/components/group/GroupCreateModal";
import { GroupList, type Group } from "@/components/group/GroupListModal";
import AppHeader from "@/components/layout/AppHeader";

/**
 * グループ一覧ページ。
 *
 * 所属グループと参加可能な公開グループを GroupList コンポーネントで表示する。
 * - 所属グループのリンクをクリック → そのグループのノート一覧へ遷移
 * - 即時参加（open）→ ノート一覧へ遷移
 * - 参加申請（request）→ 「申請済み」表示 + キャンセルボタン
 * - 「グループを作成」→ GroupCreateModal → 作成後にノート一覧へ遷移
 */
export default function GroupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
        setGroups(await res.json());
      } catch {
        router.replace("/organizations");
      } finally {
        setIsLoading(false);
      }
    }
    fetchGroups();
  }, [orgId, router]);

  if (isNotFound) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">読み込み中...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1">
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
          unjoinedEmptyText="参加可能なグループがありません。"
        />
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
    </div>
  );
}
