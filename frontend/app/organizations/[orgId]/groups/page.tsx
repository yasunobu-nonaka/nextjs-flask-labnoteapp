"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import CreateGroupWizard from "@/components/CreateGroupWizard";

/**
 * グループ一覧リダイレクトページ。
 * 組織切り替えモーダルなどから組織 ID のみ指定されて遷移した場合に、
 * 最初の所属グループのノート一覧へ自動的に転送する。
 * 所属グループが見つからない場合はグループ作成ウィザードを表示する。
 */
export default function GroupsRedirectPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  /* ローディングが終わりグループなしと確定したら true */
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    async function redirect() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/groups`);
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          router.replace("/organizations");
          return;
        }
        const groups = await res.json();
        /* role が null でないものが所属グループ */
        const firstJoined = groups.find(
          (g: { role: string | null }) => g.role !== null,
        );
        if (firstJoined) {
          router.replace(
            `/organizations/${orgId}/groups/${firstJoined.id}/notes`,
          );
        } else {
          /* 所属グループがない場合はグループ作成ウィザードを表示する */
          setShowWizard(true);
        }
      } catch {
        router.replace("/organizations");
      }
    }
    redirect();
  }, [orgId, router]);

  /* グループなし確定前はローディング表示 */
  if (!showWizard) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  return (
    /* グループがない組織に遷移したときの初期グループ作成画面 */
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center mb-8 absolute top-1/4">
        <h1 className="text-lg font-semibold mb-1">グループがありません</h1>
        <p className="text-sm text-gray-500">
          最初のグループを作成してノートを始めましょう。
        </p>
      </div>
      {/* 共通ウィザードコンポーネントでグループを作成する */}
      <CreateGroupWizard
        orgId={orgId}
        onClose={() => router.push("/organizations")}
        onCreated={(group) =>
          router.push(`/organizations/${orgId}/groups/${group.id}/notes`)
        }
      />
    </main>
  );
}
