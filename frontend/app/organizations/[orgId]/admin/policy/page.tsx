"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { JOIN_METHOD_OPTIONS, WHO_CAN_CREATE_OPTIONS } from "@/lib/constants";
import RadioGroup from "@/components/common/RadioGroup";
import { type OrgPolicy } from "@/lib/types";

/**
 * 組織管理: ポリシー管理ページ。
 * 各ポリシー項目をラジオボタンで選択し、変更があれば「変更を保存」ボタンで一括更新する。
 *
 * savedPolicy: API から取得した現在の値（比較基準）
 * editPolicy:  ユーザーが操作中の値（ラジオボタンの選択に連動）
 * 両者が異なる場合のみ保存ボタンを表示する。
 */
export default function ConsolePolicyPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  // API から取得した確定済みの値
  const [savedPolicy, setSavedPolicy] = useState<OrgPolicy | null>(null);
  // ラジオボタンの操作で変化する編集中の値
  const [editPolicy, setEditPolicy] = useState<OrgPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchPolicy() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 404) {
          setIsNotFound(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setFetchError("ポリシーの取得に失敗しました");
          setLoading(false);
          return;
        }
        const data = await res.json();
        const p: OrgPolicy = data.policy ?? null;
        setSavedPolicy(p);
        setEditPolicy(p);
      } catch {
        setFetchError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchPolicy();
  }, [orgId, router]);

  /** editPolicy の1フィールドを更新する汎用ハンドラ */
  function updateField<K extends keyof OrgPolicy>(key: K, value: OrgPolicy[K]) {
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
      const res = await authFetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify({ policy: editPolicy }),
      });
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

  if (isNotFound) {
    notFound();
  }

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
          {/* プライベートグループの許可 */}
          <div className="flex flex-col gap-3 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">プライベートグループの作成</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                組織メンバーがプライベートグループを作成できるかどうか
              </p>
            </div>
            <RadioGroup
              spacious
              name="allow_private_groups"
              options={[
                { value: true, label: "許可" },
                { value: false, label: "禁止" },
              ]}
              value={editPolicy.allow_private_groups}
              onChange={(v) => updateField("allow_private_groups", v)}
            />
          </div>

          {/* プライベートノートの許可 */}
          <div className="flex flex-col gap-3 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">プライベートノートの作成</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                グループメンバーがプライベートノートを作成できるかどうか
              </p>
            </div>
            <RadioGroup
              spacious
              name="allow_private_notes"
              options={[
                { value: true, label: "許可" },
                { value: false, label: "禁止" },
              ]}
              value={editPolicy.allow_private_notes}
              onChange={(v) => updateField("allow_private_notes", v)}
            />
          </div>

          {/* グループ作成権限 */}
          <div className="flex flex-col gap-3 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">グループを作成できるロール</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                このロール以上のメンバーが新しいグループを作成できます
              </p>
            </div>
            <RadioGroup
              spacious
              name="who_can_create_groups"
              options={WHO_CAN_CREATE_OPTIONS}
              value={editPolicy.who_can_create_groups}
              onChange={(v) => updateField("who_can_create_groups", v)}
            />
          </div>

          {/* デフォルト参加方式 */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">グループのデフォルト参加方式</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                新しく作成されるグループの初期参加方式です。各グループのポリシー画面から個別に変更できます。管理者による直接招待はどの方式でも常に可能です。
              </p>
            </div>
            <RadioGroup
              spacious
              name="default_join_method"
              options={JOIN_METHOD_OPTIONS}
              value={editPolicy.default_join_method}
              onChange={(v) => updateField("default_join_method", v)}
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

          {/* 保存成功メッセージ: 変更がなくなった直後に表示 */}
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
