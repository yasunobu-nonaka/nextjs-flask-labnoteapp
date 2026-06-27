"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { authFetch } from "@/lib/api";
import AppHeader from "@/components/AppHeader";

/** 組織管理画面にアクセスできるロール */
const ADMIN_ROLES = ["owner", "sys_admin", "user_admin"];

/**
 * 組織管理の共通レイアウト。
 * マウント時に現在ユーザーの組織ロールを確認し、権限がなければグループ一覧へリダイレクトする。
 * 左サイドバーにナビゲーションを表示し、右側に各セクションのコンテンツを描画する。
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const router = useRouter();

  /**
   * null = 権限チェック中
   * true = アクセス許可
   * false = アクセス拒否（リダイレクト済み）
   */
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 404) {
          setIsNotFound(true);
          return;
        }
        if (!res.ok) {
          router.push(`/organizations/${orgId}/groups`);
          return;
        }
        const data = await res.json();
        if (!ADMIN_ROLES.includes(data.role)) {
          router.push(`/organizations/${orgId}/groups`);
          return;
        }
        setOrgName(data.name);
        setAuthorized(true);
      } catch {
        router.push(`/organizations/${orgId}/groups`);
      }
    }
    checkAccess();
  }, [orgId, router]);

  if (isNotFound) {
    notFound();
  }

  /* 権限チェック中はコンテンツを表示しない（ちらつき防止） */
  if (authorized === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-gray-500">確認中...</p>
      </div>
    );
  }

  const navItems = [
    { label: "基本設定", href: `/organizations/${orgId}/admin` },
    { label: "メンバー管理", href: `/organizations/${orgId}/admin/members` },
    { label: "グループ管理", href: `/organizations/${orgId}/admin/groups` },
    { label: "ポリシー管理", href: `/organizations/${orgId}/admin/policy` },
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
          {/* ノートページへ戻るリンク */}
          <Link
            href={`/organizations/${orgId}/groups`}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            ← ノートに戻る
          </Link>
          <div className="px-2 mt-1 flex flex-col gap-0.5">
            <p className="text-lg text-gray-400 uppercase tracking-wider font-semibold">
              組織管理
            </p>
            <h1 className="text-2xl font-semibold">{orgName}</h1>
          </div>
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
        <AppHeader showLogo={false} backHref={`/organizations/${orgId}/groups`} backLabel="ノート一覧へ" />
        {/* メインコンテンツエリア: 各ページの内容を表示する */}
        <main className="flex-1 overflow-y-auto px-10 py-10">{children}</main>
      </div>
    </div>
  );
}
