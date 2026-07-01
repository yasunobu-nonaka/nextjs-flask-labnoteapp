"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { OrgList, type Organization } from "@/components/org/OrgSwitchModal";
import AppHeader from "@/components/layout/AppHeader";
import OrgCreateModal from "@/components/org/OrgCreateModal";
import Link from "next/link";

/**
 * 組織一覧ページ。
 * 所属組織をリンク一覧で表示し、新規組織の作成ボタンを提供する。
 * 組織リンクをクリックするとそのグループ一覧ページへ遷移する。
 */
export default function OrganizationsPage() {
  const router = useRouter();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOrgCreateModalOpen, setIsOrgCreateModalOpen] = useState(false);

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
          {/* ページヘッダー: タイトルと組織作成ボタン */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">組織一覧</h1>
            <button
              onClick={() => setIsOrgCreateModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              組織を作成
            </button>
          </div>
          <section className="flex flex-col gap-3">
            <OrgList orgs={orgs} isLoading={isLoading} error={error} />
            {/* 組織がない場合のみホームへのリンクを表示する */}
            {!isLoading && !error && orgs.length === 0 && (
              <Link
                href="/home"
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
              >
                ホームへ
              </Link>
            )}
          </section>
        </div>
      </main>

      {/* 組織作成モーダル: 作成後は新しい組織のグループページへ遷移する */}
      <OrgCreateModal
        isOpen={isOrgCreateModalOpen}
        onClose={() => setIsOrgCreateModalOpen(false)}
        onCreated={(org) => router.push(`/organizations/${org.id}/groups`)}
      />
    </div>
  );
}
