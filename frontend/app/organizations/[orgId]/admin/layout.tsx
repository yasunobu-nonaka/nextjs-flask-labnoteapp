"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

/**
 * 組織管理の共通レイアウト。
 * 左サイドバーにナビゲーションを表示し、右側に各セクションのコンテンツを描画する。
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();

  const navItems = [
    { label: "基本設定", href: `/organizations/${orgId}/admin` },
    { label: "メンバー管理", href: `/organizations/${orgId}/admin/members` },
    { label: "グループ管理", href: `/organizations/${orgId}/admin/groups` },
    { label: "ポリシー管理", href: `/organizations/${orgId}/admin/policy` },
  ];

  return (
    <div className="h-screen overflow-hidden flex bg-background text-foreground">
      {/* 左サイドバー: ナビゲーションリンクを縦に並べる */}
      <aside className="w-60 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col px-4 py-8 gap-6">
        <div className="flex flex-col gap-2">
          {/* ノートページへ戻るリンク */}
          <Link
            href={`/organizations/${orgId}/groups`}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            ← ノートに戻る
          </Link>
          <h1 className="text-lg font-bold px-2 mt-1">組織管理</h1>
        </div>

        {/* ナビゲーション: アクティブな項目をハイライトする */}
        <nav className="flex flex-col gap-1">
          {navItems.map(({ label, href }) => {
            /* 基本設定は完全一致、その他は前方一致でアクティブ判定する */
            const isActive =
              href === `/organizations/${orgId}/admin`
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg text-base transition-colors ${
                  isActive
                    ? "bg-gray-100 dark:bg-gray-800 font-semibold"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* メインコンテンツエリア: 各ページの内容を表示する */}
      <main className="flex-1 overflow-y-auto px-10 py-10">{children}</main>
    </div>
  );
}
