"use client";

import { useParams } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import HomeSidebar from "@/components/layout/HomeSidebar";

/**
 * グループ一覧ページ。
 * グループの取得・作成・参加はすべて HomeSidebar が担う。
 * メインコンテンツはグループ未選択の案内メッセージのみ表示する。
 */
export default function GroupsPage() {
  const { orgId } = useParams<{ orgId: string }>();

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground flex">
      {/* 左カラム: 現在の組織をハイライトし、グループ一覧を表示するサイドバー */}
      <HomeSidebar selectedOrgId={orgId} />

      {/* 右カラム: ヘッダー + メインコンテンツ */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader showLogo={false} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 dark:text-gray-500 text-base">
            グループが選択されていません。左のサイドバーから選択してください。
          </p>
        </div>
      </div>
    </main>
  );
}
