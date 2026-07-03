"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import HomeSidebar from "@/components/layout/HomeSidebar";
import OrgCreateModal from "@/components/org/OrgCreateModal";

/**
 * 組織一覧ページ。
 * 組織がない場合は作成を促す空状態を表示する。
 * 組織がある場合は HomeSidebar から選択するよう案内する。
 */
export default function OrganizationsPage() {
  const router = useRouter();
  const [hasOrgs, setHasOrgs] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrgCreateModalOpen, setIsOrgCreateModalOpen] = useState(false);

  useEffect(() => {
    async function fetchOrgs() {
      try {
        // オンボーディング状態を先に確認し、未完了ユーザーをウィザードへ誘導する
        const meRes = await authFetch("/api/auth/me");
        if (meRes.status === 401) {
          router.replace("/login");
          return;
        }
        if (meRes.ok) {
          const me = await meRes.json();
          // ウィザードをスキップ済みのユーザーはリダイレクトしない
          const skipped = localStorage.getItem("onboarding_skipped");
          if (me.needs_onboarding && !skipped) {
            router.replace("/onboarding");
            return;
          }
        }

        const res = await authFetch("/api/organizations");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.ok) {
          const orgs = await res.json();
          setHasOrgs(orgs.length > 0);
        }
      } catch {
        // エラーは空状態として扱う
      } finally {
        setIsLoading(false);
      }
    }
    fetchOrgs();
  }, [router]);

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground flex">
      {/* 左カラム: 組織ナビゲーションサイドバー */}
      <HomeSidebar />

      {/* 右カラム: ヘッダー + メインコンテンツ */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader showLogo={false} />
        <div className="flex-1 flex items-center justify-center">
          {isLoading ? (
            <p className="text-gray-500 text-base">読み込み中...</p>
          ) : !hasOrgs ? (
            /* 組織がない場合: 作成を促す空状態 */
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">はじめましょう</h1>
                <p className="text-gray-500 text-base">
                  まず組織を作成して、チームメンバーとノートを共有しましょう。
                </p>
              </div>
              <button
                onClick={() => setIsOrgCreateModalOpen(true)}
                className="px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity"
              >
                組織を作成する
              </button>
              {/* スキップ済みユーザーがウィザードに戻れるリンク */}
              <button
                onClick={() => {
                  localStorage.removeItem("onboarding_skipped");
                  router.push("/onboarding");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                セットアップウィザードに戻る
              </button>
            </div>
          ) : (
            /* 組織がある場合: サイドバーから選択するよう案内する */
            <p className="text-gray-400 dark:text-gray-500 text-base">
              組織が選択されていません。左のサイドバーから選択してください。
            </p>
          )}
        </div>
      </div>

      {/* 組織作成モーダル */}
      <OrgCreateModal
        isOpen={isOrgCreateModalOpen}
        onClose={() => setIsOrgCreateModalOpen(false)}
        onCreated={(org) => router.push(`/organizations/${org.id}/groups`)}
      />
    </main>
  );
}
