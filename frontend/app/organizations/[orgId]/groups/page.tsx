"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

/**
 * グループ一覧リダイレクトページ。
 * 組織切り替えモーダルなどから組織 ID のみ指定されて遷移した場合に、
 * 最初の所属グループのノート一覧へ自動的に転送する。
 * 所属グループが見つからない場合は組織一覧へ戻す。
 */
export default function GroupsRedirectPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

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
        // role が null でないものが所属グループ
        const firstJoined = groups.find(
          (g: { role: string | null }) => g.role !== null,
        );
        if (firstJoined) {
          router.replace(
            `/organizations/${orgId}/groups/${firstJoined.id}/notes`,
          );
        } else {
          // 所属グループがない場合は組織一覧へ戻す
          router.replace("/organizations");
        }
      } catch {
        router.replace("/organizations");
      }
    }
    redirect();
  }, [orgId, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-gray-500">読み込み中...</p>
    </main>
  );
}
