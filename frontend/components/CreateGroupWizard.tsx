"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import { GROUP_ROLE_LABELS, JOIN_METHOD_OPTIONS } from "@/lib/constants";
import RadioGroup from "@/components/RadioGroup";

type OrgMember = {
  user_id: number;
  username: string;
  email: string;
  role: string;
};

/** ウィザードの Step 2 で積んだ追加予定メンバー */
type PendingMember = {
  userId: number;
  username: string;
  email: string;
  role: string;
};

const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"] as const;


type Props = {
  orgId: string;
  /** グループ作成成功後に呼ばれる。作成されたグループの基本情報を受け取る。 */
  onCreated: (group: { id: number; name: string }) => void;
};

/**
 * グループ作成ウィザードの中身（共通コンポーネント）。
 * モーダルを持たないため、呼び出し側が必要に応じて <Modal> で包む。
 * - FolderSidebar: <Modal> で包んでオーバーレイ表示
 * - groups/page.tsx: ページ内にそのまま埋め込み
 *
 * Step 1: グループ名・公開設定・ポリシー
 * Step 2: メンバー追加（任意。0件のまま作成すれば作成者のみ）
 * 右から左へスライドするアニメーションでステップを遷移する。
 */
export default function CreateGroupWizard({ orgId, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  // ---- Step 1 フォーム ----
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [policy, setPolicy] = useState({
    allow_private_notes: true,
    join_method: "invite_only",
    is_notes_visible_to_org: false,
  });

  // ---- Step 2: 組織メンバーと追加予定リスト ----
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [orgMembersLoading, setOrgMembersLoading] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [addUserId, setAddUserId] = useState<number | "">("");
  const [addRole, setAddRole] = useState("editor");

  // ---- 作成処理 ----
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // マウント時に組織メンバー一覧を取得する（Step 2 のドロップダウン用）
  useEffect(() => {
    async function fetchOrgMembers() {
      setOrgMembersLoading(true);
      try {
        const res = await authFetch(`/api/organizations/${orgId}/members`);
        if (res.ok) {
          setOrgMembers(await res.json());
        }
      } catch {
        // 取得失敗時も Step 1 の操作は続行できる
      } finally {
        setOrgMembersLoading(false);
      }
    }
    fetchOrgMembers();
  }, [orgId]);

  // 追加予定でない組織メンバーのみドロップダウンに表示する
  const pendingIds = new Set(pendingMembers.map((p) => p.userId));
  const addableOrgMembers = orgMembers.filter((m) => !pendingIds.has(m.user_id));

  /** 選択中のメンバーを追加予定リストに積む */
  function handleAddToPending() {
    if (addUserId === "") return;
    const member = addableOrgMembers.find((m) => m.user_id === addUserId);
    if (!member) return;
    setPendingMembers((prev) => [
      ...prev,
      {
        userId: member.user_id,
        username: member.username,
        email: member.email,
        role: addRole,
      },
    ]);
    setAddUserId("");
  }

  /** 追加予定リストから1件取り除く */
  function handleRemoveFromPending(userId: number) {
    setPendingMembers((prev) => prev.filter((p) => p.userId !== userId));
  }

  /**
   * グループを作成する。
   * pendingMembers がある場合は initial_members として一緒に送り、1トランザクションで確定する。
   */
  async function handleCreate() {
    setIsCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        is_private: isPrivate,
        policy,
      };
      if (pendingMembers.length > 0) {
        body.initial_members = pendingMembers.map((p) => ({
          user_id: p.userId,
          role: p.role,
        }));
      }
      const res = await authFetch(`/api/organizations/${orgId}/groups`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json();
        setCreateError(json.message ?? "作成に失敗しました");
        return;
      }
      const data = await res.json();
      onCreated(data.group);
    } catch {
      setCreateError("サーバーへの接続に失敗しました");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 text-sm mb-1">
        <span
          className={
            step === 1 ? "font-semibold" : "text-gray-400 dark:text-gray-500"
          }
        >
          1. 設定
        </span>
        <span className="text-gray-300 dark:text-gray-600">›</span>
        <span
          className={
            step === 2 ? "font-semibold" : "text-gray-400 dark:text-gray-500"
          }
        >
          2. メンバー
        </span>
      </div>

      {/* スライドパネル: overflow-hidden でアクティブなステップのみ表示する */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{
            width: "200%",
            transform: step === 2 ? "translateX(-50%)" : "translateX(0)",
          }}
        >
          {/* ---- Step 1: グループ名・設定 ---- */}
          <div className="w-1/2 flex flex-col gap-5 pr-6">
            {/* グループ名と公開設定 */}
            <div className="flex flex-col gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">グループ名</label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="グループ名を入力"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">公開設定</label>
                <select
                  value={isPrivate ? "private" : "public"}
                  onChange={(e) => setIsPrivate(e.target.value === "private")}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-background focus:outline-none focus:ring-1 focus:ring-foreground text-base"
                >
                  <option value="public">公開グループ</option>
                  <option value="private">非公開グループ</option>
                </select>
              </div>
            </div>

            {/* プライベートノートの作成 */}
            <div className="flex flex-col gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold">プライベートノートの作成</p>
              <RadioGroup
                name="wizard_allow_private_notes"
                options={[
                  { value: true, label: "許可" },
                  { value: false, label: "禁止" },
                ]}
                value={policy.allow_private_notes}
                onChange={(v) =>
                  setPolicy((p) => ({ ...p, allow_private_notes: v }))
                }
              />
            </div>

            {/* 参加方式 */}
            <div className="flex flex-col gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold">参加方式</p>
              <RadioGroup
                name="wizard_join_method"
                options={JOIN_METHOD_OPTIONS}
                value={policy.join_method}
                onChange={(v) => setPolicy((p) => ({ ...p, join_method: v }))}
              />
            </div>

            {/* 組織メンバーへのノート公開 */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">ノートを組織メンバーに公開</p>
              <RadioGroup
                name="wizard_is_notes_visible_to_org"
                options={[
                  { value: true, label: "公開する" },
                  { value: false, label: "公開しない" },
                ]}
                value={policy.is_notes_visible_to_org}
                onChange={(v) =>
                  setPolicy((p) => ({ ...p, is_notes_visible_to_org: v }))
                }
              />
            </div>

            {/* 次へボタン: グループ名が空なら無効 */}
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              次へ
            </button>
          </div>

          {/* ---- Step 2: メンバー追加 ---- */}
          <div className="w-1/2 flex flex-col gap-5 pl-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="self-start text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              ← 戻る
            </button>

            {orgMembersLoading ? (
              <p className="text-sm text-gray-500">メンバーを読み込み中...</p>
            ) : (
              <>
                {/* メンバー選択行: 追加できる組織メンバーがいる場合のみ表示 */}
                {addableOrgMembers.length > 0 && (
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex flex-col gap-1 flex-1 min-w-40">
                      <label className="text-sm font-medium">メンバー</label>
                      {/* 組織メンバーのうち追加予定でないメンバーのみ表示する */}
                      <select
                        value={addUserId}
                        onChange={(e) =>
                          setAddUserId(
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value),
                          )
                        }
                        className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                      >
                        <option value="">メンバーを選択</option>
                        {addableOrgMembers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.username}（{m.email}）
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">ロール</label>
                      <select
                        value={addRole}
                        onChange={(e) => setAddRole(e.target.value)}
                        className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                      >
                        {ASSIGNABLE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {GROUP_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddToPending}
                      disabled={addUserId === ""}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      リストに追加
                    </button>
                  </div>
                )}

                {/* 追加予定リスト */}
                {pendingMembers.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-gray-500">
                      追加予定（{pendingMembers.length} 件）
                    </p>
                    <ul className="flex flex-col gap-1">
                      {pendingMembers.map((p) => (
                        <li
                          key={p.userId}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm"
                        >
                          <span className="font-medium">{p.username}</span>
                          <span className="text-gray-500 dark:text-gray-400 flex-1 truncate">
                            {p.email}
                          </span>
                          <span className="text-gray-600 dark:text-gray-300 shrink-0">
                            {GROUP_ROLE_LABELS[p.role]}
                          </span>
                          {/* 追加予定リストから取り除くボタン */}
                          <button
                            type="button"
                            onClick={() => handleRemoveFromPending(p.userId)}
                            className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                            aria-label={`${p.username} を追加予定から外す`}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {addableOrgMembers.length === 0 && pendingMembers.length === 0 && (
                  <p className="text-sm text-gray-500">
                    追加できる組織メンバーがいません。
                  </p>
                )}
              </>
            )}

            {createError && (
              <p className="text-sm text-red-500">{createError}</p>
            )}

            {/* グループ作成ボタン: メンバー数に関わらず常に有効（0件 = 作成者のみ） */}
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isCreating
                ? "作成中..."
                : pendingMembers.length > 0
                  ? `グループを作成（${pendingMembers.length} 件のメンバーを追加）`
                  : "グループを作成"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
