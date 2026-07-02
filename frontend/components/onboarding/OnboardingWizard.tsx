"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import {
  WHO_CAN_CREATE_OPTIONS,
  JOIN_METHOD_OPTIONS,
  ORG_ROLE_LABELS,
} from "@/lib/constants";
import RadioGroup from "@/components/common/RadioGroup";
import { type OrgPolicy } from "@/lib/types";

/** 招待リストの1エントリ（メール送信前の中間状態）。 */
type PendingInvitation = { id: number; email: string; role: string };

/**
 * ウィザードのステップ識別子。
 * org-name〜group-prompt まで全 API を保留し、done で一括送信する。
 */
type WizardStep =
  | "org-name"
  | "org-policy"
  | "org-invitations"
  | "group-prompt"
  | "group-name"
  | "group-policy"
  | "done";

const STEP_ORDER: WizardStep[] = [
  "org-name",
  "org-policy",
  "org-invitations",
  "group-prompt",
  "group-name",
  "group-policy",
  "done",
];

/** 各ステップのスライド位置（0始まり）。 */
function posOf(step: WizardStep): number {
  return STEP_ORDER.indexOf(step);
}

/**
 * フェーズインジケーター用のフェーズ番号。
 * 組織設定=0 / 招待=1 / グループ設定=2 / 完了=3
 */
function phaseOf(step: WizardStep): number {
  if (step === "org-name" || step === "org-policy") return 0;
  if (step === "org-invitations") return 1;
  if (
    step === "group-prompt" ||
    step === "group-name" ||
    step === "group-policy"
  )
    return 2;
  return 3;
}

const PHASE_LABELS = ["組織設定", "招待", "グループ設定", "完了"] as const;
const N_PANELS = STEP_ORDER.length; // 7
const PANEL_W = `${100 / N_PANELS}%`;

/** 招待に割り当て可能な組織ロール（owner は自分自身なので除外）。 */
const INVITE_ROLES = ["sys_admin", "user_admin", "member"] as const;

/**
 * オンボーディングセットアップウィザード。
 * フォームデータを全ステップで保持し、最終の「始める」ボタンで一括作成する。
 *
 * - org-name → org-policy: 組織名・ポリシーを収集
 * - org-invitations: 招待予定リストを収集（スキップ可）
 * - group-prompt: グループ作成の有無を選択
 *   - No: done へ即時ジャンプ（スライドアニメーションなし）
 *   - Yes: group-name → group-policy → done
 * - done: 確認サマリーを表示し「始める」で一括 API 送信
 */
export default function OnboardingWizard() {
  const router = useRouter();
  /** 招待エントリのクライアント側キー生成用カウンタ */
  const nextId = useRef(0);

  const [step, setStep] = useState<WizardStep>("org-name");
  /**
   * group-prompt → done のスキップ時はスライドアニメーションを無効化する。
   * 中間パネルが視覚的に通過するのを防ぐため。
   */
  const [animated, setAnimated] = useState(true);

  // ---- 組織設定 ----
  const [orgName, setOrgName] = useState("");
  const [orgPolicy, setOrgPolicy] = useState<OrgPolicy>({
    allow_private_groups: true,
    allow_private_notes: true,
    who_can_create_groups: "member",
    default_join_method: "invite_only",
  });

  // ---- 招待 ----
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingInvitation[]
  >([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  // ---- グループ設定 ----
  const [wantsGroup, setWantsGroup] = useState<boolean | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupIsPrivate, setGroupIsPrivate] = useState(false);
  const [groupPolicy, setGroupPolicy] = useState({
    allow_private_notes: true,
    join_method: "invite_only",
    is_notes_visible_to_org: false,
  });

  // ---- 送信状態 ----
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * アニメーションなしでステップを変更する。
   * group-prompt → done のスキップなど、遠いパネルへジャンプする際に使う。
   * double-RAF でブラウザが描画を確定した後にアニメーションを再有効化する。
   */
  function jumpTo(target: WizardStep) {
    setAnimated(false);
    setStep(target);
  }

  useEffect(() => {
    if (!animated) {
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimated(true)),
      );
      return () => cancelAnimationFrame(id);
    }
  }, [animated]);

  /** ウィザード全体をスキップして /organizations へ進む。 */
  function handleSkipWizard() {
    localStorage.setItem("onboarding_skipped", "1");
    router.push("/organizations");
  }

  /** 入力中のメールアドレスを招待予定リストに追加する。重複は無視する。 */
  function handleAddInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    if (pendingInvitations.some((p) => p.email === email)) {
      setInviteEmail("");
      return;
    }
    setPendingInvitations((prev) => [
      ...prev,
      { id: nextId.current++, email, role: inviteRole },
    ]);
    setInviteEmail("");
  }

  /**
   * 最終ステップの「始める」で全データを一括送信する。
   *
   * 1. POST /api/organizations — 組織とポリシーを作成
   * 2. POST /api/organizations/{id}/invitations — 招待を順次送信（個別エラーは無視）
   * 3. POST /api/organizations/{id}/groups — グループとポリシーを作成（スキップ時は省略）
   * 4. 作成したグループのノート一覧、またはグループ一覧へ遷移
   */
  async function handleFinish() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. 組織を作成する
      const orgRes = await authFetch("/api/organizations", {
        method: "POST",
        body: JSON.stringify({ name: orgName.trim(), policy: orgPolicy }),
      });
      if (!orgRes.ok) {
        const json = await orgRes.json();
        setSubmitError(json.message ?? "組織の作成に失敗しました");
        return;
      }
      const orgData = await orgRes.json();
      const orgId: number = orgData.organization.id;
      localStorage.removeItem("onboarding_skipped");

      // 2. 招待を順次送信する（個別エラーはあとから org 管理画面で対応可能なので無視）
      for (const inv of pendingInvitations) {
        await authFetch(`/api/organizations/${orgId}/invitations`, {
          method: "POST",
          body: JSON.stringify({ email: inv.email, role: inv.role }),
        }).catch(() => {});
      }

      // 3. グループを作成する（スキップ時は省略）
      let groupId: number | null = null;
      if (wantsGroup && groupName.trim()) {
        const groupRes = await authFetch(
          `/api/organizations/${orgId}/groups`,
          {
            method: "POST",
            body: JSON.stringify({
              name: groupName.trim(),
              is_private: groupIsPrivate,
              policy: groupPolicy,
            }),
          },
        );
        if (!groupRes.ok) {
          const json = await groupRes.json();
          setSubmitError(json.message ?? "グループの作成に失敗しました");
          return;
        }
        const groupData = await groupRes.json();
        groupId = groupData.group.id;
      }

      // 4. グループ作成済みならノート一覧へ、なければグループ一覧へ遷移する
      if (groupId) {
        router.push(`/organizations/${orgId}/groups/${groupId}/notes`);
      } else {
        router.push(`/organizations/${orgId}/groups`);
      }
    } catch {
      setSubmitError("サーバーへの接続に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentPhase = phaseOf(step);
  const translateX = `translateX(-${posOf(step) * (100 / N_PANELS)}%)`;

  return (
    <div className="w-full max-w-lg px-4">
      <div className="bg-background border border-gray-200 dark:border-gray-700 rounded-2xl p-8 flex flex-col gap-6">
        {/* ロゴ + タイトル */}
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono tracking-widest uppercase">
            LabNote
          </p>
          <h1 className="text-xl font-semibold">セットアップ</h1>
        </div>

        {/* フェーズインジケーター */}
        <div className="flex items-center gap-2 text-sm">
          {PHASE_LABELS.map((label, i) => (
            <span key={label} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-gray-300 dark:text-gray-600">›</span>
              )}
              <span
                className={
                  i === currentPhase
                    ? "font-semibold"
                    : "text-gray-400 dark:text-gray-500"
                }
              >
                {label}
              </span>
            </span>
          ))}
        </div>

        {/* スライドパネル: overflow-hidden でアクティブなステップのみ表示する */}
        <div className="overflow-hidden">
          <div
            className={
              animated
                ? "flex transition-transform duration-300 ease-in-out"
                : "flex"
            }
            style={{
              width: `${N_PANELS * 100}%`,
              transform: translateX,
            }}
          >
            {/* ---- org-name: 組織名 ---- */}
            <div
              style={{ width: PANEL_W }}
              className="flex flex-col gap-5 pr-6"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">組織名</label>
                <input
                  autoFocus
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && orgName.trim())
                      setStep("org-policy");
                  }}
                  placeholder="例: ラボ研究チーム"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
                />
              </div>
              {/* 組織名が空のときは次へボタンを無効化する */}
              <button
                type="button"
                onClick={() => setStep("org-policy")}
                disabled={!orgName.trim()}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                次へ
              </button>
              {/* ウィザード全体をスキップして /organizations へ進む */}
              <button
                type="button"
                onClick={handleSkipWizard}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-center"
              >
                スキップ（あとで設定する）
              </button>
            </div>

            {/* ---- org-policy: 組織ポリシー ---- */}
            <div
              style={{ width: PANEL_W }}
              className="flex flex-col gap-5 px-6"
            >
              <button
                type="button"
                onClick={() => setStep("org-name")}
                className="self-start text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ← 戻る
              </button>

              {/* グループ作成権限 */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">グループの作成権限</p>
                <RadioGroup
                  name="onboarding_who_can_create_groups"
                  options={WHO_CAN_CREATE_OPTIONS}
                  value={orgPolicy.who_can_create_groups}
                  onChange={(v) =>
                    setOrgPolicy((p) => ({ ...p, who_can_create_groups: v }))
                  }
                />
              </div>

              {/* デフォルト参加方式 */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">デフォルト参加方式</p>
                <RadioGroup
                  name="onboarding_default_join_method"
                  options={JOIN_METHOD_OPTIONS}
                  value={orgPolicy.default_join_method}
                  onChange={(v) =>
                    setOrgPolicy((p) => ({ ...p, default_join_method: v }))
                  }
                />
              </div>

              <button
                type="button"
                onClick={() => setStep("org-invitations")}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
              >
                次へ
              </button>
              {/* ウィザード全体をスキップして /organizations へ進む */}
              <button
                type="button"
                onClick={handleSkipWizard}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-center"
              >
                スキップ（あとで設定する）
              </button>
            </div>

            {/* ---- org-invitations: 組織メンバー招待 ---- */}
            <div
              style={{ width: PANEL_W }}
              className="flex flex-col gap-5 px-6"
            >
              <button
                type="button"
                onClick={() => setStep("org-policy")}
                className="self-start text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ← 戻る
              </button>

              {/* メールアドレスとロールの入力行 */}
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex flex-col gap-1 flex-1 min-w-40">
                  <label className="text-sm font-medium">メールアドレス</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddInvite();
                    }}
                    placeholder="example@email.com"
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">ロール</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    {INVITE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ORG_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddInvite}
                  disabled={!inviteEmail.trim()}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  リストに追加
                </button>
              </div>

              {/* 招待予定リスト */}
              {pendingInvitations.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-gray-500">
                    招待予定（{pendingInvitations.length} 件）
                  </p>
                  <ul className="flex flex-col gap-1">
                    {pendingInvitations.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm"
                      >
                        <span className="flex-1 truncate">{p.email}</span>
                        <span className="text-gray-600 dark:text-gray-300 shrink-0">
                          {ORG_ROLE_LABELS[p.role]}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingInvitations((prev) =>
                              prev.filter((x) => x.id !== p.id),
                            )
                          }
                          className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                          aria-label={`${p.email} を招待リストから外す`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep("group-prompt")}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
              >
                {pendingInvitations.length > 0
                  ? `次へ（${pendingInvitations.length} 件招待）`
                  : "次へ"}
              </button>
            </div>

            {/* ---- group-prompt: グループを作成しますか？ ---- */}
            <div
              style={{ width: PANEL_W }}
              className="flex flex-col gap-5 px-6"
            >
              <button
                type="button"
                onClick={() => setStep("org-invitations")}
                className="self-start text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ← 戻る
              </button>

              <div className="flex flex-col gap-1.5">
                <p className="text-base font-semibold">
                  グループを作成しますか？
                </p>
                <p className="text-sm text-gray-500">
                  グループはメンバーとノートを共有する単位です。あとから追加することもできます。
                </p>
              </div>

              {/* Yes/No を並べて選択させる */}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setWantsGroup(true);
                    setStep("group-name");
                  }}
                  className="px-4 py-3 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
                >
                  はい、作成する
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWantsGroup(false);
                    // 中間パネルを視覚的に通過しないよう即時ジャンプする
                    jumpTo("done");
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-base font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  スキップ
                </button>
              </div>
            </div>

            {/* ---- group-name: グループ名・公開設定 ---- */}
            <div
              style={{ width: PANEL_W }}
              className="flex flex-col gap-5 px-6"
            >
              <button
                type="button"
                onClick={() => setStep("group-prompt")}
                className="self-start text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ← 戻る
              </button>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">グループ名</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && groupName.trim())
                      setStep("group-policy");
                  }}
                  placeholder="例: 論文執筆チーム"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">公開設定</label>
                <select
                  value={groupIsPrivate ? "private" : "public"}
                  onChange={(e) =>
                    setGroupIsPrivate(e.target.value === "private")
                  }
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-background focus:outline-none focus:ring-1 focus:ring-foreground text-base"
                >
                  <option value="public">公開グループ</option>
                  <option value="private">非公開グループ</option>
                </select>
              </div>

              {/* グループ名が空のときは次へボタンを無効化する */}
              <button
                type="button"
                onClick={() => setStep("group-policy")}
                disabled={!groupName.trim()}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                次へ
              </button>
            </div>

            {/* ---- group-policy: グループポリシー ---- */}
            <div
              style={{ width: PANEL_W }}
              className="flex flex-col gap-5 px-6"
            >
              <button
                type="button"
                onClick={() => setStep("group-name")}
                className="self-start text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ← 戻る
              </button>

              {/* プライベートノートの作成許可 */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">プライベートノートの作成</p>
                <RadioGroup
                  name="onboarding_allow_private_notes"
                  options={[
                    { value: true, label: "許可" },
                    { value: false, label: "禁止" },
                  ]}
                  value={groupPolicy.allow_private_notes}
                  onChange={(v) =>
                    setGroupPolicy((p) => ({ ...p, allow_private_notes: v }))
                  }
                />
              </div>

              {/* グループへの参加方式 */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">参加方式</p>
                <RadioGroup
                  name="onboarding_group_join_method"
                  options={JOIN_METHOD_OPTIONS}
                  value={groupPolicy.join_method}
                  onChange={(v) =>
                    setGroupPolicy((p) => ({ ...p, join_method: v }))
                  }
                />
              </div>

              {/* グループのノートを組織全体へ公開するか */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">
                  ノートを組織メンバーに公開
                </p>
                <RadioGroup
                  name="onboarding_is_notes_visible_to_org"
                  options={[
                    { value: true, label: "公開する" },
                    { value: false, label: "公開しない" },
                  ]}
                  value={groupPolicy.is_notes_visible_to_org}
                  onChange={(v) =>
                    setGroupPolicy((p) => ({
                      ...p,
                      is_notes_visible_to_org: v,
                    }))
                  }
                />
              </div>

              <button
                type="button"
                onClick={() => setStep("done")}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
              >
                次へ
              </button>
            </div>

            {/* ---- done: 確認・一括作成 ---- */}
            <div
              style={{ width: PANEL_W }}
              className="flex flex-col gap-5 pl-6"
            >
              <button
                type="button"
                onClick={() =>
                  setStep(wantsGroup ? "group-policy" : "group-prompt")
                }
                disabled={isSubmitting}
                className="self-start text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-40"
              >
                ← 戻る
              </button>

              {/* ウェルカムメッセージ */}
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">ようこそ！始めましょう</h2>
                <p className="text-sm text-gray-500">
                  以下の内容でセットアップを完了します。
                </p>
              </div>

              {/* 作成内容のサマリー */}
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-500 shrink-0 w-12">組織</span>
                  <span className="font-medium">{orgName}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-500 shrink-0 w-12">招待</span>
                  <span>
                    {pendingInvitations.length > 0
                      ? `${pendingInvitations.length} 件`
                      : "なし"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-500 shrink-0 w-12">グループ</span>
                  <span className="font-medium">
                    {wantsGroup && groupName ? groupName : "なし"}
                  </span>
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-red-500">{submitError}</p>
              )}

              {/* 始めるボタンで全 API を一括送信する */}
              <button
                type="button"
                onClick={handleFinish}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? "作成中..." : "始める"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
