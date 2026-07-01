"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { authFetch } from "@/lib/api";
import OrgCreateModal from "@/components/org/OrgCreateModal";

type Org = {
  id: number;
  name: string;
  role: string;
};

type Props = {
  /** 現在選択中の組織 ID。一致する組織をハイライト表示する。 */
  selectedOrgId?: string;
};

/**
 * HomeSidebar コンポーネント
 * ホーム・組織・グループページ共通の左サイドバー。
 * アプリロゴと所属組織の一覧を表示し、各組織のグループページへのナビゲーションを提供する。
 * 「作成」ボタンから新規組織を作成できる。
 * selectedOrgId と一致する組織をハイライト表示する。
 */
export default function HomeSidebar({ selectedOrgId }: Props = {}) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [isOrgCreateModalOpen, setIsOrgCreateModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await authFetch("/api/organizations");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          setOrgs(await res.json());
        }
      } catch (err) {
        console.error("組織一覧の取得に失敗しました", err);
      }
    }
    fetchOrgs();
  }, [router]);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 pt-4 pb-6 px-3 flex flex-col gap-4">
      {/* アプリロゴ: クリックするとホームへ戻る */}
      <div className="h-12 flex items-center px-2 pt-2 shrink-0">
        <Link
          href="/organizations"
          className="text-2xl font-bold tracking-tight hover:opacity-75 transition-opacity"
        >
          LabNoteApp
        </Link>
      </div>

      {/* 組織一覧セクション */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2">
          {/* セクションラベル */}
          <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            組織
          </span>
          {/* 組織作成ボタン */}
          <button
            onClick={() => setIsOrgCreateModalOpen(true)}
            className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
          >
            作成
          </button>
        </div>

        {orgs.length > 0 ? (
          /* 所属組織のリスト */
          <div className="flex flex-col gap-1.5 px-2">
            {orgs.map((org) => {
              const isSelected = String(org.id) === selectedOrgId;
              const canManageOrg = ["owner", "sys_admin", "user_admin"].includes(org.role);
              return (
                <div
                  key={org.id}
                  className={clsx(
                    "flex items-center gap-0.5 rounded-lg transition-colors",
                    isSelected
                      ? "bg-gray-300 dark:bg-gray-600"
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
                  )}
                >
                  {/* 組織名: グループ一覧ページへのリンク */}
                  <Link
                    href={`/organizations/${org.id}/groups`}
                    className={clsx(
                      "flex-1 flex items-center px-2 py-1.5 min-w-0",
                      isSelected && "font-semibold",
                    )}
                  >
                    <span className="truncate text-base">{org.name}</span>
                  </Link>
                  {/* ⚙ アイコン: owner / sys_admin / user_admin のみ表示する */}
                  {canManageOrg && (
                    <Link
                      href={`/organizations/${org.id}/admin`}
                      className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-1 rounded text-lg"
                      title={`${org.name} の管理`}
                    >
                      ⚙
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* 組織がない場合の空状態メッセージ */
          <p className="px-2 text-sm text-gray-400 dark:text-gray-500">
            まだ組織に所属していません
          </p>
        )}
      </div>

      {/* 組織作成モーダル: 作成後は新しい組織のグループページへ遷移する */}
      <OrgCreateModal
        isOpen={isOrgCreateModalOpen}
        onClose={() => setIsOrgCreateModalOpen(false)}
        onCreated={(org) => {
          setIsOrgCreateModalOpen(false);
          router.push(`/organizations/${org.id}/groups`);
        }}
      />
    </aside>
  );
}
