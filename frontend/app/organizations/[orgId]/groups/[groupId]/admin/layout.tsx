"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import { PendingCountContext } from "./pending-count-context";

/** グループ管理画面にアクセスできる組織ロール */
const ORG_ADMIN_ROLES = ["owner", "sys_admin", "user_admin"];

/**
 * グループ管理の共通レイアウト。
 * グループ管理者（admin ロール）または組織の owner/sys_admin/user_admin のみアクセスできる。
 * マウント時にグループと組織の両方のロールを確認し、いずれも該当しない場合はノートページへリダイレクトする。
 * 左サイドバーにナビゲーションを表示し、右側に各セクションのコンテンツを描画する。
 */
export default function GroupAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId, groupId } = useParams<{ orgId: string; groupId: string }>();
  const pathname = usePathname();
  const router = useRouter();

  /**
   * null = 権限チェック中
   * true = アクセス許可
   */
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [groupName, setGroupName] = useState("");
  /** 未承認の参加申請数（メンバー管理ナビのバッジ用） */
  const [pendingCount, setPendingCount] = useState(0);

  /** join-requests/count を叩いて pendingCount を更新する。children から Context 経由で呼ばれる。 */
  const fetchPendingCount = useCallback(async () => {
    const countRes = await authFetch(
      `/api/organizations/${orgId}/groups/${groupId}/join-requests/count`
    );
    if (countRes.ok) {
      const countData = await countRes.json();
      setPendingCount(countData.count ?? 0);
    }
  }, [orgId, groupId]);

  useEffect(() => {
    async function checkAccess() {
      try {
        // グループロールと組織ロールを並行取得して権限を確認する
        const [groupRes, orgRes] = await Promise.all([
          authFetch(`/api/organizations/${orgId}/groups/${groupId}`),
          authFetch(`/api/organizations/${orgId}`),
        ]);

        if (groupRes.status === 401) {
          router.push("/login");
          return;
        }
        if (groupRes.status === 404 || orgRes.status === 404) {
          setIsNotFound(true);
          return;
        }
        if (!groupRes.ok || !orgRes.ok) {
          router.push(`/organizations/${orgId}/groups/${groupId}/notes`);
          return;
        }

        const groupData = await groupRes.json();
        const orgData = await orgRes.json();

        const isGroupAdmin = groupData.role === "admin";
        const isOrgAdmin = ORG_ADMIN_ROLES.includes(orgData.role);

        if (!isGroupAdmin && !isOrgAdmin) {
          router.push(`/organizations/${orgId}/groups/${groupId}/notes`);
          return;
        }

        setGroupName(groupData.name);
        setAuthorized(true);

        // 権限確認後に参加申請数を取得する
        await fetchPendingCount();
      } catch {
        router.push(`/organizations/${orgId}/groups/${groupId}/notes`);
      }
    }
    checkAccess();
  }, [orgId, groupId, router, fetchPendingCount]);

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
    {
      label: "基本設定",
      href: `/organizations/${orgId}/groups/${groupId}/admin`,
    },
    {
      label: "メンバー管理",
      href: `/organizations/${orgId}/groups/${groupId}/admin/members`,
    },
    {
      label: "ポリシー管理",
      href: `/organizations/${orgId}/groups/${groupId}/admin/policy`,
    },
  ];

  return (
    <PendingCountContext.Provider
      value={{ pendingCount, refreshPendingCount: fetchPendingCount }}
    >
    <div className="h-screen overflow-hidden flex bg-background text-foreground">
      {/* 左サイドバー: ナビゲーションリンクを縦に並べる（画面上端まで広がる） */}
      <aside className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col pt-4 px-4 gap-6">
        {/* アプリロゴ: FolderSidebar と高さをそろえる */}
        <div className="h-12 flex items-center px-2 pt-2 shrink-0">
          <span className="text-2xl font-bold tracking-tight">LabNoteApp</span>
        </div>
        <div className="flex flex-col gap-2">
          {/* ノートページへ戻るリンク */}
          <Link
            href={`/organizations/${orgId}/groups/${groupId}/notes`}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            ← ノートに戻る
          </Link>
          <div className="px-2 mt-1 flex flex-col gap-0.5">
            <p className="text-lg text-gray-400 uppercase tracking-wider font-semibold">
              グループ管理
            </p>
            <h1 className="text-2xl font-semibold">{groupName}</h1>
          </div>
        </div>

        {/* ナビゲーション: アクティブな項目をハイライトする */}
        <nav className="flex flex-col gap-1">
          {navItems.map(({ label, href }) => {
            /* 基本設定は完全一致、その他は前方一致でアクティブ判定する */
            const isActive =
              href === `/organizations/${orgId}/groups/${groupId}/admin`
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center px-3 py-2 rounded-lg text-base transition-colors ${
                  isActive
                    ? "bg-gray-100 dark:bg-gray-800 font-semibold"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {label}
                {/* メンバー管理ナビのみ未承認申請数バッジを表示する */}
                {label === "メンバー管理" && pendingCount > 0 && (
                  <span className="ml-auto text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-5 text-center leading-tight">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 右カラム: ヘッダー＋メインコンテンツ */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 共通ヘッダー: ベル通知・ユーザーメニューを提供する */}
        <AppHeader />
        {/* メインコンテンツエリア: 各ページの内容を表示する */}
        <main className="flex-1 overflow-y-auto px-10 py-10">{children}</main>
      </div>
    </div>
    </PendingCountContext.Provider>
  );
}
