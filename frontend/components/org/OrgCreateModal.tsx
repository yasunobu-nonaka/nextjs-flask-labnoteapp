"use client";

import { useState } from "react";
import { authFetch } from "@/lib/api";
import Modal from "@/components/common/Modal";
import RadioGroup from "@/components/common/RadioGroup";
import { JOIN_METHOD_OPTIONS, WHO_CAN_CREATE_OPTIONS } from "@/lib/constants";
import { type OrgPolicy } from "@/lib/types";

const DEFAULT_POLICY: OrgPolicy = {
  allow_private_groups: true,
  allow_private_notes: true,
  who_can_create_groups: "member",
  default_join_method: "invite_only",
};

/**
 * OrgCreateModal コンポーネント
 * 組織名とポリシー設定を入力して新規組織を作成するモーダル。
 * 作成成功後は onCreated を呼び、親コンポーネントが遷移先を決定する。
 */
export default function OrgCreateModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (org: { id: number; name: string }) => void;
}) {
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgPolicy, setNewOrgPolicy] = useState<OrgPolicy>(DEFAULT_POLICY);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgCreateError, setOrgCreateError] = useState<string | null>(null);

  /** モーダルを閉じてフォーム入力をリセットする */
  function handleClose() {
    setNewOrgName("");
    setNewOrgPolicy(DEFAULT_POLICY);
    setOrgCreateError(null);
    onClose();
  }

  /** 組織を作成して onCreated コールバックを呼ぶ */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = newOrgName.trim();
    if (!trimmed) return;

    setIsCreatingOrg(true);
    setOrgCreateError(null);
    try {
      const res = await authFetch("/api/organizations", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, policy: newOrgPolicy }),
      });
      if (!res.ok) {
        const json = await res.json();
        setOrgCreateError(json.message ?? "作成に失敗しました");
        return;
      }
      const data = await res.json();
      handleClose();
      onCreated(data.organization);
    } catch {
      setOrgCreateError("サーバーへの接続に失敗しました");
    } finally {
      setIsCreatingOrg(false);
    }
  }

  if (!isOpen) return null;

  return (
    <Modal title="組織を作成" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* 組織名 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold">組織名</label>
          <input
            autoFocus
            type="text"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="組織名を入力"
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
          />
        </div>

        {/* プライベートグループの作成 */}
        <div className="flex flex-col gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold">プライベートグループの作成</p>
          <RadioGroup
            name="org_allow_private_groups"
            options={[
              { value: true, label: "許可" },
              { value: false, label: "禁止" },
            ]}
            value={newOrgPolicy.allow_private_groups}
            onChange={(v) =>
              setNewOrgPolicy((p) => ({ ...p, allow_private_groups: v }))
            }
          />
        </div>

        {/* プライベートノートの作成 */}
        <div className="flex flex-col gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold">プライベートノートの作成</p>
          <RadioGroup
            name="org_allow_private_notes"
            options={[
              { value: true, label: "許可" },
              { value: false, label: "禁止" },
            ]}
            value={newOrgPolicy.allow_private_notes}
            onChange={(v) =>
              setNewOrgPolicy((p) => ({ ...p, allow_private_notes: v }))
            }
          />
        </div>

        {/* グループ作成権限 */}
        <div className="flex flex-col gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold">グループ作成権限</p>
          <RadioGroup
            name="org_who_can_create_groups"
            options={WHO_CAN_CREATE_OPTIONS}
            value={newOrgPolicy.who_can_create_groups}
            onChange={(v) =>
              setNewOrgPolicy((p) => ({ ...p, who_can_create_groups: v }))
            }
          />
        </div>

        {/* デフォルト参加方式 */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">
            グループへのデフォルト参加方式
          </p>
          <RadioGroup
            name="org_default_join_method"
            options={JOIN_METHOD_OPTIONS}
            value={newOrgPolicy.default_join_method}
            onChange={(v) =>
              setNewOrgPolicy((p) => ({ ...p, default_join_method: v }))
            }
          />
        </div>

        {orgCreateError && (
          <p className="text-sm text-red-500">{orgCreateError}</p>
        )}

        <button
          type="submit"
          disabled={isCreatingOrg || !newOrgName.trim()}
          className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isCreatingOrg ? "作成中..." : "作成"}
        </button>
      </form>
    </Modal>
  );
}
