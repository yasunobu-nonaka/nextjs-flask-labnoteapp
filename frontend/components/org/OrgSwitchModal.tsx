"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import Modal from "@/components/common/Modal";

export type Organization = {
  id: number;
  name: string;
  role: string;
};

/**
 * OrgList コンポーネント
 * 所属組織の一覧をリンク形式で表示する。
 * モーダル内でもページ上でもそのまま使える。
 *
 * - onOrgClick: 組織リンクをクリックしたとき呼ばれる（例: モーダルを閉じる）
 */
export function OrgList({
  orgs,
  isLoading,
  error,
  onOrgClick,
}: {
  orgs: Organization[];
  isLoading: boolean;
  error: string | null;
  onOrgClick?: () => void;
}) {
  if (isLoading) {
    return <p className="text-gray-500 text-base">読み込み中...</p>;
  }
  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }
  if (orgs.length === 0) {
    return (
      <p className="text-gray-500 text-base">所属している組織がありません。</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {orgs.map((org) => (
        <li key={org.id}>
          <Link
            href={`/organizations/${org.id}/groups`}
            onClick={onOrgClick}
            className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all"
          >
            <span className="text-base font-medium">{org.name}</span>
            <span className="text-sm text-gray-400">{org.role}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * OrgSwitchModal コンポーネント
 * OrgList をモーダル内に表示する薄いラッパー。
 * 開くたびに /api/organizations を取得してリストを最新状態に保つ。
 */
export default function OrgSwitchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchOrgs() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await authFetch("/api/organizations");
        if (res.ok) {
          setOrgs(await res.json());
        } else {
          setError("組織一覧の取得に失敗しました");
        }
      } catch {
        setError("サーバーへの接続に失敗しました");
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrgs();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal title="組織を選択" onClose={onClose}>
      <section className="flex flex-col gap-3">
        <OrgList
          orgs={orgs}
          isLoading={isLoading}
          error={error}
          onOrgClick={onClose}
        />
      </section>
    </Modal>
  );
}
