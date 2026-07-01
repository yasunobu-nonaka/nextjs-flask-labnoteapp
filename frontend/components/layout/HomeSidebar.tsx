"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import OrgCreateModal from "@/components/org/OrgCreateModal";

type Org = {
  id: number;
  name: string;
  role: string;
};

/**
 * HomeSidebar コンポーネント
 * ホームページ用の左サイドバー。
 * アプリロゴと所属組織の一覧を表示し、各組織のグループページへのナビゲーションを提供する。
 * 「作成」ボタンから新規組織を作成できる。
 */
export default function HomeSidebar() {
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
          href="/home"
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
          /* 所属組織のリスト: 各組織のグループ一覧ページへリンクする */
          <div className="flex flex-col gap-1.5 px-2">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/organizations/${org.id}/groups`}
                className="flex items-center px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="truncate text-base">{org.name}</span>
              </Link>
            ))}
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
