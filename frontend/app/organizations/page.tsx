"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { OrgList, type Organization } from "@/components/OrgSwitchModal";
import AppHeader from "@/components/AppHeader";

/**
 * 組織一覧ページ。
 * ログイン後の初期遷移先として機能し、所属組織をリンク一覧で表示する。
 * 組織リンクをクリックするとそのグループ一覧ページへ遷移する。
 */
export default function OrganizationsPage() {
  const router = useRouter();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await authFetch("/api/organizations");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setError("組織一覧の取得に失敗しました");
          return;
        }
        setOrgs(await res.json());
      } catch {
        setError("サーバーへの接続に失敗しました");
      } finally {
        setIsLoading(false);
      }
    }
    fetchOrgs();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-16 flex flex-col gap-8">
          <h1 className="text-lg font-semibold">組織一覧</h1>
          <section className="flex flex-col gap-3">
            <OrgList orgs={orgs} isLoading={isLoading} error={error} />
          </section>
        </div>
      </main>
    </div>
  );
}
