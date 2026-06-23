"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

type GroupPolicy = {
  allow_private_notes: boolean;
  join_method: string;
  is_notes_visible_to_org: boolean;
};

const JOIN_METHOD_OPTIONS: {
  value: string;
  label: string;
  description: string;
}[] = [
  {
    value: "invite_only",
    label: "招待のみ",
    description:
      "管理者が招待したユーザーのみ参加できます。外部からの参加申請は受け付けません。",
  },
  {
    value: "request",
    label: "招待または申請",
    description:
      "組織メンバーが参加を申請でき、管理者が承認または拒否します。管理者による直接招待も引き続き可能です。",
  },
  {
    value: "open",
    label: "オープン",
    description:
      "組織メンバーであれば誰でも自由に参加できます。管理者による直接招待も引き続き可能です。",
  },
];

/**
 * ラジオボタングループ。
 * name に一意な名前を指定することで同一ページ内の複数グループが干渉しない。
 * description が指定された場合はラベルの下に補足説明を表示する。
 */
function RadioGroup<T extends string | boolean>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => (
        <label
          key={String(opt.value)}
          className="flex items-start gap-2 cursor-pointer"
        >
          {/* ラジオボタンをテキスト行の先頭に揃える */}
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="w-4 h-4 mt-0.5 accent-foreground shrink-0"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-base">{opt.label}</span>
            {opt.description && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {opt.description}
              </span>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

/**
 * グループ管理: ポリシー管理ページ。
 * 各ポリシー項目をラジオボタンで選択し、変更があれば「変更を保存」ボタンで一括更新する。
 *
 * savedPolicy: API から取得した現在の値（比較基準）
 * editPolicy:  ユーザーが操作中の値（ラジオボタンの選択に連動）
 * 両者が異なる場合のみ保存ボタンを表示する。
 */
export default function GroupAdminPolicyPage() {
  const { orgId, groupId } = useParams<{ orgId: string; groupId: string }>();
  const router = useRouter();

  // API から取得した確定済みの値
  const [savedPolicy, setSavedPolicy] = useState<GroupPolicy | null>(null);
  // ラジオボタンの操作で変化する編集中の値
  const [editPolicy, setEditPolicy] = useState<GroupPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchPolicy() {
      try {
        const res = await authFetch(
          `/api/organizations/${orgId}/groups/${groupId}`,
        );
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setFetchError("ポリシーの取得に失敗しました");
          setLoading(false);
          return;
        }
        const data = await res.json();
        const p: GroupPolicy = data.policy ?? null;
        setSavedPolicy(p);
        setEditPolicy(p);
      } catch {
        setFetchError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchPolicy();
  }, [orgId, groupId, router]);

  /** editPolicy の1フィールドを更新する汎用ハンドラ */
  function updateField<K extends keyof GroupPolicy>(
    key: K,
    value: GroupPolicy[K],
  ) {
    setSaveSuccess(false);
    setSaveError(null);
    setEditPolicy((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  /**
   * editPolicy を PATCH で保存する。
   * 成功後は savedPolicy を editPolicy に合わせて保存ボタンを非表示にする。
   */
  async function handleSave() {
    if (!editPolicy) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ policy: editPolicy }),
        },
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const json = await res.json();
        setSaveError(json.message ?? "更新に失敗しました");
        return;
      }
      setSavedPolicy(editPolicy);
      setSaveSuccess(true);
    } catch {
      setSaveError("サーバーへの接続に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  // JSON.stringify で全フィールドを比較し、差分があれば保存ボタンを表示する
  const hasChanges =
    savedPolicy !== null &&
    editPolicy !== null &&
    JSON.stringify(editPolicy) !== JSON.stringify(savedPolicy);

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <h2 className="text-2xl font-bold">ポリシー管理</h2>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : fetchError ? (
        <p className="text-red-500 text-sm">{fetchError}</p>
      ) : !editPolicy ? (
        <p className="text-gray-500">ポリシーが設定されていません。</p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* プライベートノートの許可 */}
          <div className="flex flex-col gap-3 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">プライベートノートの作成</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                グループメンバーがプライベートノートを作成できるかどうか
              </p>
            </div>
            <RadioGroup
              name="allow_private_notes"
              options={[
                { value: true, label: "許可" },
                { value: false, label: "禁止" },
              ]}
              value={editPolicy.allow_private_notes}
              onChange={(v) => updateField("allow_private_notes", v)}
            />
          </div>

          {/* グループへの参加方式 */}
          <div className="flex flex-col gap-3 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">グループへの参加方式</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                組織メンバーが自分でグループに参加できるかどうかを制御します。管理者による直接招待はどの方式でも常に可能です。
              </p>
            </div>
            <RadioGroup
              name="join_method"
              options={JOIN_METHOD_OPTIONS}
              value={editPolicy.join_method}
              onChange={(v) => updateField("join_method", v)}
            />
          </div>

          {/* 組織へのノート公開 */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">
                ノートを組織メンバーに公開
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                グループ外の組織メンバーがこのグループのノートを閲覧できるかどうか
              </p>
            </div>
            <RadioGroup
              name="is_notes_visible_to_org"
              options={[
                { value: true, label: "公開する" },
                { value: false, label: "公開しない" },
              ]}
              value={editPolicy.is_notes_visible_to_org}
              onChange={(v) => updateField("is_notes_visible_to_org", v)}
            />
          </div>

          {/* 保存エリア: 変更があるときのみ表示 */}
          {hasChanges && (
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              {saveError && (
                <p className="text-sm text-red-500">{saveError}</p>
              )}
              <div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {isSaving ? "保存中..." : "変更を保存"}
                </button>
              </div>
            </div>
          )}

          {saveSuccess && !hasChanges && (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ ポリシーを更新しました
            </p>
          )}
        </div>
      )}
    </div>
  );
}
