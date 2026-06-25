"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import Modal from "@/components/Modal";

type Organization = {
  id: number;
  name: string;
  role: string;
};

/**
 * OrgSwitchModal コンポーネント
 * ユーザーが所属する組織の一覧を表示し、切り替え先を選択できるモーダル。
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
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  // isOpen が true になるたびに組織一覧を取得する
  useEffect(() => {
    if (!isOpen) return;

    async function fetchOrgs() {
      setOrgsLoading(true);
      setOrgsError(null);
      try {
        const res = await authFetch("/api/organizations");
        if (res.ok) {
          setOrgs(await res.json());
        } else {
          setOrgsError("組織一覧の取得に失敗しました");
        }
      } catch {
        setOrgsError("サーバーへの接続に失敗しました");
      } finally {
        setOrgsLoading(false);
      }
    }

    fetchOrgs();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal title="組織を選択" onClose={onClose}>
      <section className="flex flex-col gap-3">
        {orgsLoading ? (
          <p className="text-gray-500 text-base">読み込み中...</p>
        ) : orgsError ? (
          <p className="text-red-500 text-sm">{orgsError}</p>
        ) : orgs.length === 0 ? (
          <p className="text-gray-500 text-base">
            所属している組織がありません。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orgs.map((org) => (
              <li key={org.id}>
                <Link
                  href={`/organizations/${org.id}/groups`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all"
                  onClick={onClose}
                >
                  <span className="text-base font-medium">{org.name}</span>
                  <span className="text-sm text-gray-400">{org.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}
