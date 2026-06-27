"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import AppHeader from "@/components/AppHeader";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/organizations";
  const pathname = usePathname();

  const navItems = [
    { label: "基本設定", href: `/settings` },
    { label: "セキュリティ", href: `/settings/security` },
  ];

  return (
    <div className="h-screen overflow-hidden flex bg-background text-foreground">
      {/* 左サイドバー: ナビゲーションリンクを縦に並べる（画面上端まで広がる） */}
      <aside className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col pt-4 px-4 gap-6">
        {/* アプリロゴ */}
        <div className="h-12 flex items-center px-2 pt-2 shrink-0">
          <span className="text-2xl font-bold tracking-tight">LabNoteApp</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="px-2 mt-1 flex flex-col gap-0.5">
            <p className="text-lg text-gray-400 uppercase tracking-wider font-semibold">
              ユーザー設定
            </p>
          </div>
        </div>

        {/* ナビゲーション: アクティブな項目をハイライトする */}
        <nav className="flex flex-col gap-1">
          {navItems.map(({ label, href }) => {
            /* 基本設定は完全一致、その他は前方一致でアクティブ判定する */
            const isActive =
              href === `/settings`
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "px-3 py-2 rounded-lg text-base transition-colors",
                  isActive
                    ? "bg-gray-100 dark:bg-gray-800 font-semibold"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 右カラム: ヘッダー＋メインコンテンツ */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 共通ヘッダー: ベル通知・ユーザーメニューを提供する */}
        <AppHeader
          showLogo={false}
          backHref={returnTo}
          backLabel="戻る"
        />
        {/* メインコンテンツエリア: 各ページの内容を表示する */}
        <main className="flex-1 overflow-y-auto px-10 py-10">{children}</main>
      </div>
    </div>
  );
}
