"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import {
  WHO_CAN_CREATE_OPTIONS,
  JOIN_METHOD_OPTIONS,
  ORG_ROLE_LABELS,
} from "@/lib/constants";
import RadioGroup from "@/components/common/RadioGroup";
import { type OrgPolicy } from "@/lib/types";

/**
 * 招待リストの1エントリ（メール送信前の中間状態）。
 * id は重複削除ボタン用のクライアント側キー。
 */
type PendingInvitation = { id: number; email: string; role: string };

/**
 * 招待送信後の結果を1件ずつ保持する。Step 5 の結果サマリーで使う。
 */
type InviteResult = {
  id: number;
  email: string;
  status: "sent" | "error";
  message: string;
};

/** 招待に割り当て可能な組織ロール（owner は自分自身なので除外）。 */
const INVITE_ROLES = ["sys_admin", "user_admin", "member"] as const;

/**
 * オンボーディングセットアップウィザード。
 * 5ステップで初めての組織作成・ポリシー設定・グループ作成・メンバー招待を行う。
 *
 * Step 1: 組織名の入力
 * Step 2: ポリシー設定 → ここで POST /api/organizations を実行
 * Step 3: グループ作成（スキップ可）→ POST /api/organizations/{id}/groups を実行
 * Step 4: メンバーの招待（スキップ可）→ POST /api/organizations/{id}/invitations を順次実行
 * Step 5: 完了サマリー → グループノート一覧 or 組織グループ一覧へ遷移
 *
 * Step 3 以降は組織作成済みのため「戻る」ボタンを非表示にする。
 */
export default function OnboardingWizard() {
  const router = useRouter();
  /** 招待エントリのクライアント側キー生成用カウンタ */
  const nextId = useRef(0);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // ---- Step 1: 組織名 ----
  const [orgName, setOrgName] = useState("");

  // ---- Step 2: ポリシー設定 ----
  const [policy, setPolicy] = useState<OrgPolicy>({
    allow_private_groups: true,
    allow_private_notes: true,
    who_can_create_groups: "member",
    default_join_method: "invite_only",
  });

  // ---- Step 2→3 遷移時に org を作成して id を保持 ----
  const [createdOrg, setCreatedOrg] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgCreateError, setOrgCreateError] = useState<string | null>(null);

  // ---- Step 3: グループ作成 ----
  const [groupName, setGroupName] = useState("");
  const [createdGroup, setCreatedGroup] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupCreateError, setGroupCreateError] = useState<string | null>(null);

  // ---- Step 4: メンバーの招待 ----
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingInvitation[]
  >([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [inviteResults, setInviteResults] = useState<InviteResult[]>([]);

  /**
   * ウィザード全体をスキップする。
   * localStorage にフラグを立てて /organizations のリダイレクトガードを通過させる。
   */
  function handleSkipWizard() {
    localStorage.setItem("onboarding_skipped", "1");
    router.push("/organizations");
  }

  /**
   * Step 2 → Step 3 遷移: 組織を作成してから次のステップへ進む。
   * 二重送信防止のため先頭で isCreatingOrg を確認する。
   */
  async function handleCreateOrg() {
    if (isCreatingOrg) return;
    setIsCreatingOrg(true);
    setOrgCreateError(null);
    try {
      const res = await authFetch("/api/organizations", {
        method: "POST",
        body: JSON.stringify({ name: orgName.trim(), policy }),
      });
      if (!res.ok) {
        const json = await res.json();
        setOrgCreateError(json.message ?? "組織の作成に失敗しました");
        return;
      }
      const data = await res.json();
      setCreatedOrg({ id: data.organization.id, name: data.organization.name });
      // 組織が作成されたのでスキップフラグは不要
      localStorage.removeItem("onboarding_skipped");
      setStep(3);
    } catch {
      setOrgCreateError("サーバーへの接続に失敗しました");
    } finally {
      setIsCreatingOrg(false);
    }
  }

  /**
   * Step 3 → Step 4 遷移: グループを作成してから次のステップへ進む。
   * 二重送信防止のため先頭で isCreatingGroup を確認する。
   */
  async function handleCreateGroup() {
    if (isCreatingGroup || !createdOrg) return;
    setIsCreatingGroup(true);
    setGroupCreateError(null);
    try {
      const res = await authFetch(
        `/api/organizations/${createdOrg.id}/groups`,
        {
          method: "POST",
          body: JSON.stringify({ name: groupName.trim() }),
        },
      );
      if (!res.ok) {
        const json = await res.json();
        setGroupCreateError(json.message ?? "グループの作成に失敗しました");
        return;
      }
      const data = await res.json();
      setCreatedGroup({ id: data.group.id, name: data.group.name });
      setStep(4);
    } catch {
      setGroupCreateError("サーバーへの接続に失敗しました");
    } finally {
      setIsCreatingGroup(false);
    }
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
   * Step 4 → Step 5 遷移: 招待予定リストを順次送信してから完了ステップへ進む。
   * 個別の送信エラーは記録するが全件試行後に Step 5 へ進む（ブロッキングしない）。
   */
  async function handleSendInvitesAndAdvance() {
    if (isSendingInvites || !createdOrg) return;
    if (pendingInvitations.length === 0) {
      setStep(5);
      return;
    }

    setIsSendingInvites(true);
    const results: InviteResult[] = [];

    for (const inv of pendingInvitations) {
      try {
        const res = await authFetch(
          `/api/organizations/${createdOrg.id}/invitations`,
          {
            method: "POST",
            body: JSON.stringify({ email: inv.email, role: inv.role }),
          },
        );
        results.push({
          id: inv.id,
          email: inv.email,
          status: res.ok ? "sent" : "error",
          message: res.ok ? "送信済み" : "送信に失敗しました",
        });
      } catch {
        results.push({
          id: inv.id,
          email: inv.email,
          status: "error",
          message: "接続エラー",
        });
      }
    }

    setInviteResults(results);
    setIsSendingInvites(false);
    setStep(5);
  }

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

        {/* ステップインジケーター */}
        <div className="flex items-center gap-2 text-sm">
          {(
            [
              "1. 組織名",
              "2. ポリシー",
              "3. グループ",
              "4. 招待",
              "5. 完了",
            ] as const
          ).map((label, i) => (
            <span key={label} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-gray-300 dark:text-gray-600">›</span>
              )}
              <span
                className={
                  step === i + 1
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
            className="flex transition-transform duration-300 ease-in-out"
            style={{
              width: "500%",
              transform: `translateX(-${(step - 1) * 20}%)`,
            }}
          >
            {/* ---- Step 1: 組織名 ---- */}
            <div className="w-1/5 flex flex-col gap-5 pr-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">組織名</label>
                <input
                  autoFocus
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && orgName.trim()) setStep(2);
                  }}
                  placeholder="例: ラボ研究チーム"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
                />
              </div>
              {/* 組織名が空のときは次へボタンを無効化する */}
              <button
                type="button"
                onClick={() => setStep(2)}
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

            {/* ---- Step 2: ポリシー設定 ---- */}
            <div className="w-1/5 flex flex-col gap-5 px-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="self-start text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                ← 戻る
              </button>

              {/* グループ作成権限: WHO_CAN_CREATE_OPTIONS の値を使う */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">グループの作成権限</p>
                <RadioGroup
                  name="onboarding_who_can_create_groups"
                  options={WHO_CAN_CREATE_OPTIONS}
                  value={policy.who_can_create_groups}
                  onChange={(v) =>
                    setPolicy((p) => ({ ...p, who_can_create_groups: v }))
                  }
                />
              </div>

              {/* デフォルト参加方式: JOIN_METHOD_OPTIONS の値を使う */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">デフォルト参加方式</p>
                <RadioGroup
                  name="onboarding_default_join_method"
                  options={JOIN_METHOD_OPTIONS}
                  value={policy.default_join_method}
                  onChange={(v) =>
                    setPolicy((p) => ({ ...p, default_join_method: v }))
                  }
                />
              </div>

              {orgCreateError && (
                <p className="text-sm text-red-500">{orgCreateError}</p>
              )}

              {/* 「次へ」クリックで組織を作成する */}
              <button
                type="button"
                onClick={handleCreateOrg}
                disabled={isCreatingOrg}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isCreatingOrg ? "作成中..." : "次へ"}
              </button>
              {/* ウィザード全体をスキップして /organizations へ進む */}
              <button
                type="button"
                onClick={handleSkipWizard}
                disabled={isCreatingOrg}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-center disabled:opacity-40"
              >
                スキップ（あとで設定する）
              </button>
            </div>

            {/* ---- Step 3: グループ作成 ---- */}
            <div className="w-1/5 flex flex-col gap-5 px-6">
              {/* 戻るボタンは表示しない: Step 2 で組織を作成済みのため */}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">グループ名</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && groupName.trim())
                      handleCreateGroup();
                  }}
                  placeholder="例: 論文執筆チーム"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
                />
              </div>

              {groupCreateError && (
                <p className="text-sm text-red-500">{groupCreateError}</p>
              )}

              {/* グループ名が空のときは次へボタンを無効化する */}
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !groupName.trim()}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isCreatingGroup ? "作成中..." : "次へ"}
              </button>

              {/* 招待ステップへスキップ（グループ作成を後回しにする）*/}
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={isCreatingGroup}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-center disabled:opacity-40"
              >
                スキップ（あとで作成する）
              </button>
            </div>

            {/* ---- Step 4: メンバーの招待 ---- */}
            <div className="w-1/5 flex flex-col gap-5 px-6">
              {/* 戻るボタンは表示しない: Step 2 で組織を作成済みのため */}

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

              {/* スキップ（招待リストを無視してStep 5へ進む）と招待送信ボタン */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  disabled={isSendingInvites}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-40"
                >
                  スキップ
                </button>
                <button
                  type="button"
                  onClick={handleSendInvitesAndAdvance}
                  disabled={isSendingInvites || pendingInvitations.length === 0}
                  className="flex-1 px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {isSendingInvites
                    ? "送信中..."
                    : `招待を送る（${pendingInvitations.length} 件）`}
                </button>
              </div>
            </div>

            {/* ---- Step 5: 完了 ---- */}
            <div className="w-1/5 flex flex-col gap-5 pl-6">
              {/* 組織・グループ作成結果サマリー */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <p className="text-base font-semibold">
                    {createdOrg?.name ?? ""}
                  </p>
                  <p className="text-sm text-gray-500">組織が作成されました。</p>
                </div>
                {createdGroup ? (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-base font-semibold">{createdGroup.name}</p>
                    <p className="text-sm text-gray-500">
                      グループが作成されました。
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    グループはスキップしました。
                  </p>
                )}
              </div>

              {/* 招待送信結果のサマリー */}
              {inviteResults.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-gray-500">
                    招待の送信結果
                  </p>
                  <ul className="flex flex-col gap-1">
                    {inviteResults.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm"
                      >
                        <span className="flex-1 truncate">{r.email}</span>
                        <span
                          className={
                            r.status === "sent"
                              ? "text-green-600 dark:text-green-400 shrink-0"
                              : "text-red-500 shrink-0"
                          }
                        >
                          {r.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500">招待はスキップしました。</p>
              )}

              {/*
               * グループを作成した場合はそのノート一覧へ、
               * スキップした場合は組織のグループ一覧へ遷移する。
               */}
              <button
                type="button"
                onClick={() => {
                  if (!createdOrg) return;
                  if (createdGroup) {
                    router.push(
                      `/organizations/${createdOrg.id}/groups/${createdGroup.id}/notes`,
                    );
                  } else {
                    router.push(`/organizations/${createdOrg.id}/groups`);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
              >
                ノートを始める
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
