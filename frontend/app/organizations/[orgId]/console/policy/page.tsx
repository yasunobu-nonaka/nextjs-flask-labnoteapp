"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

type OrgPolicy = {
  allow_private_groups: boolean;
  allow_private_notes: boolean;
  who_can_create_groups: string;
  default_join_method: string;
};

const WHO_CAN_CREATE_LABELS: Record<string, string> = {
  sys_admin_only: "システム管理者のみ",
  user_admin: "ユーザー管理者以上",
  member: "メンバー以上",
  all: "全員",
};

const JOIN_METHOD_LABELS: Record<string, string> = {
  invite_only: "招待のみ",
  request: "申請制",
  open: "公開",
};

/**
 * 組織コンソール: ポリシー管理ページ（Phase 5b 実装予定）。
 * 現在は組織ポリシーの表示のみ。
 */
export default function ConsolePolicyPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const router = useRouter();

  const [policy, setPolicy] = useState<OrgPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPolicy() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError("ポリシーの取得に失敗しました");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setPolicy(data.policy ?? null);
      } catch {
        setError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchPolicy();
  }, [orgId, router]);

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h2 className="text-2xl font-bold">ポリシー管理</h2>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : !policy ? (
        <p className="text-gray-500">ポリシーが設定されていません。</p>
      ) : (
        <dl className="flex flex-col gap-4">
          {/* プライベートグループの許可 */}
          <div className="flex flex-col gap-1 pb-4 border-b border-gray-100 dark:border-gray-800">
            <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              プライベートグループの作成
            </dt>
            <dd className="text-base">
              {policy.allow_private_groups ? "許可" : "禁止"}
            </dd>
          </div>

          {/* プライベートノートの許可 */}
          <div className="flex flex-col gap-1 pb-4 border-b border-gray-100 dark:border-gray-800">
            <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              プライベートノートの作成
            </dt>
            <dd className="text-base">
              {policy.allow_private_notes ? "許可" : "禁止"}
            </dd>
          </div>

          {/* グループ作成権限 */}
          <div className="flex flex-col gap-1 pb-4 border-b border-gray-100 dark:border-gray-800">
            <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              グループを作成できるロール
            </dt>
            <dd className="text-base">
              {WHO_CAN_CREATE_LABELS[policy.who_can_create_groups] ??
                policy.who_can_create_groups}
            </dd>
          </div>

          {/* デフォルト参加方式 */}
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              グループのデフォルト参加方式
            </dt>
            <dd className="text-base">
              {JOIN_METHOD_LABELS[policy.default_join_method] ??
                policy.default_join_method}
            </dd>
          </div>
        </dl>
      )}

      <p className="text-sm text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-4">
        ポリシーの編集機能は今後実装予定です。
      </p>
    </div>
  );
}
