"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

/**
 * 組織一覧リダイレクトページ。
 * ログイン後の初期遷移先として機能し、最初の所属グループのノート一覧へ自動的に転送する。
 * 所属グループが見つからない場合は /login へ戻す。
 */
export default function OrganizationsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      try {
        const orgsRes = await authFetch("/api/organizations");
        if (orgsRes.status === 401) {
          router.replace("/login");
          return;
        }
        if (!orgsRes.ok) {
          router.replace("/login");
          return;
        }
        const orgs = await orgsRes.json();
        if (orgs.length === 0) {
          router.replace("/login");
          return;
        }
        // 最初の組織のグループ一覧へ転送する（groups/page.tsx がさらに所属グループへ転送する）
        router.replace(`/organizations/${orgs[0].id}/groups`);
      } catch {
        router.replace("/login");
      }
    }
    redirect();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-gray-500">読み込み中...</p>
    </main>
  );
}
