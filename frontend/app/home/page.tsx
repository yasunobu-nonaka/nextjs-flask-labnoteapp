"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import HomeSidebar from "@/components/layout/HomeSidebar";
import OrgCreateModal from "@/components/org/OrgCreateModal";

type Org = {
  id: number;
  name: string;
  role: string;
};

/**
 * ホームページ
 * ログイン後にいつでも戻れるベース画面。
 * 組織がない場合は作成を促す空状態を表示する。
 * 組織がある場合は最後に訪れたグループへのショートカットと所属組織の一覧を表示する。
 */
export default function HomePage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrgCreateModalOpen, setIsOrgCreateModalOpen] = useState(false);
  /** localStorage から前回訪れたノート一覧 URL を取得する（SSR ではなく useEffect で読む） */
  const [lastNotesUrl, setLastNotesUrl] = useState<string | null>(null);

  useEffect(() => {
    setLastNotesUrl(localStorage.getItem("last_notes_url"));
  }, []);

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await authFetch("/api/organizations");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.ok) {
          setOrgs(await res.json());
        }
      } catch {
        // 接続エラーは空状態として扱う
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
        {/* 共通ヘッダー: ロゴはサイドバーに表示済みのため非表示にする */}
        <AppHeader showLogo={false} />

        <div className="flex-1 overflow-y-auto px-6 py-10">
          <div className="max-w-2xl mx-auto">
            {isLoading ? (
              <p className="text-gray-500 text-base">読み込み中...</p>
            ) : orgs.length === 0 ? (
              /* 組織がない場合: 組織作成を促す空状態 */
              <div className="flex flex-col items-center gap-6 py-20 text-center">
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
              </div>
            ) : (
              /* 組織がある場合: ショートカットと組織一覧 */
              <div className="flex flex-col gap-8">
                <h1 className="text-2xl font-bold">ホーム</h1>

                {/* 最後に訪れたグループへのショートカット */}
                {lastNotesUrl && (
                  <section className="flex flex-col gap-3">
                    <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wider">
                      最後に訪れたグループ
                    </h2>
                    <Link
                      href={lastNotesUrl}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-base font-medium">
                        ノートを再開する
                      </span>
                      <span className="text-sm text-gray-400">→</span>
                    </Link>
                  </section>
                )}

                {/* 所属する組織の一覧 */}
                <section className="flex flex-col gap-3">
                  <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wider">
                    所属する組織
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {orgs.map((org) => (
                      <li key={org.id}>
                        <Link
                          href={`/organizations/${org.id}/groups`}
                          className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <span className="text-base font-medium">
                            {org.name}
                          </span>
                          <span className="text-sm text-gray-400">
                            グループを見る →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 組織作成モーダル: 空状態のボタンから開く */}
      <OrgCreateModal
        isOpen={isOrgCreateModalOpen}
        onClose={() => setIsOrgCreateModalOpen(false)}
        onCreated={(org) => {
          setIsOrgCreateModalOpen(false);
          router.push(`/organizations/${org.id}/groups`);
        }}
      />
    </main>
  );
}
