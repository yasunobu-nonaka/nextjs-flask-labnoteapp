"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import CreateGroupWizard from "@/components/CreateGroupWizard";
import Link from "next/link";

type Props = {
  orgId: string;
  groupId: string;
  /** キーワード検索: 入力中の文字列 */
  query: string;
  onQueryChange: (q: string) => void;
  /** 検索フォームの送信ハンドラ */
  onSearch: () => void;
  /** 選択中のタグ一覧 */
  selectedTags: string[];
  /** 選択肢として表示するタグ一覧 */
  availableTags: string[];
  onTagToggle: (tag: string) => void;
};

type Group = {
  id: number;
  name: string;
  is_private: boolean;
  role: string | null;
};

type Organization = {
  id: number;
  name: string;
  role: string;
};

type OrgPolicy = {
  allow_private_groups: boolean;
  allow_private_notes: boolean;
  who_can_create_groups: string;
  default_join_method: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

const WHO_CAN_CREATE_OPTIONS = [
  { value: "all", label: "全員" },
  { value: "member", label: "メンバー" },
  { value: "user_admin", label: "ユーザー管理者以上" },
  { value: "sys_admin_only", label: "システム管理者のみ" },
];

const JOIN_METHOD_OPTIONS = [
  { value: "invite_only", label: "招待のみ" },
  { value: "request", label: "申請制" },
  { value: "open", label: "誰でも参加" },
];

/**
 * ラジオボタングループ。
 * name に一意な文字列を指定することで同一ページ内の複数グループが干渉しない。
 */
function RadioGroup<T extends string | boolean>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => (
        <label
          key={String(opt.value)}
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="w-4 h-4 accent-foreground"
          />
          <span className="text-sm">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * FolderSidebar コンポーネント
 * 現在の組織名・グループ一覧、キーワード検索フォーム、タグフィルターを表示する左サイドバー。
 * 「作成」ボタンで組織・グループの作成モーダルを開く。
 * 「切り替え」ボタンで組織一覧モーダル、「一覧」ボタンでグループ一覧モーダルを開く。
 */
export default function FolderSidebar({
  orgId,
  groupId,
  query,
  onQueryChange,
  onSearch,
  selectedTags,
  availableTags,
  onTagToggle,
}: Props) {
  const [orgName, setOrgName] = useState("");
  const [orgRole, setOrgRole] = useState<string | null>(null);
  // 組織ポリシー（グループ作成権限の判定に使用する）
  const [orgPolicy, setOrgPolicy] = useState<OrgPolicy | null>(null);
  // 全グループ（所属・未所属）を保持し、描画時にフィルターする
  const [groups, setGroups] = useState<Group[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);

  // モーダルの開閉状態
  const [isOrgCreateModalOpen, setIsOrgCreateModalOpen] = useState(false);
  const [isOrgSwitchModalOpen, setIsOrgSwitchModalOpen] = useState(false);
  const [isGroupCreateModalOpen, setIsGroupCreateModalOpen] = useState(false);
  const [isGroupListModalOpen, setIsGroupListModalOpen] = useState(false);

  // 組織一覧モーダルのロード状態
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const router = useRouter();

  // ---- 組織作成フォームの状態 ----
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgPolicy, setNewOrgPolicy] = useState({
    allow_private_groups: true,
    allow_private_notes: true,
    who_can_create_groups: "member",
    default_join_method: "invite_only",
  });
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgCreateError, setOrgCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCurrentOrganization() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setOrgName(data.name);
          setOrgRole(data.role ?? null);
          setOrgPolicy(data.policy ?? null);
        }
      } catch (err) {
        console.error("組織情報の取得に失敗しました", err);
      }
    }
    fetchCurrentOrganization();
  }, [orgId, router]);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/groups`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          const data: Group[] = await res.json();
          // 全グループ（所属・未所属）を保持する。表示時にフィルターする。
          setGroups(data);
        }
      } catch (err) {
        console.error("グループ一覧の取得に失敗しました", err);
      }
    }
    fetchGroups();
  }, [orgId, router]);

  /** 組織切り替えモーダルを開く。初回のみ組織一覧を取得する。 */
  async function handleOpenOrgSwitchModal() {
    setIsOrgSwitchModalOpen(true);
    if (orgs.length > 0) return;

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

  /** 組織作成モーダルを閉じてフォームをリセットする */
  function handleCloseOrgCreateModal() {
    setIsOrgCreateModalOpen(false);
    setNewOrgName("");
    setNewOrgPolicy({
      allow_private_groups: true,
      allow_private_notes: true,
      who_can_create_groups: "member",
      default_join_method: "invite_only",
    });
    setOrgCreateError(null);
  }

  /** 組織を作成してモーダルを閉じ、新組織のグループ一覧へ遷移する */
  async function handleCreateOrg(e: React.FormEvent<HTMLFormElement>) {
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
      setOrgs((prev) => [...prev, { ...data.organization, role: "owner" }]);
      handleCloseOrgCreateModal();
      router.push(`/organizations/${data.organization.id}/groups`);
    } catch {
      setOrgCreateError("サーバーへの接続に失敗しました");
    } finally {
      setIsCreatingOrg(false);
    }
  }

  // グループ作成権限の判定: orgPolicy.who_can_create_groups と orgRole を照合する
  function canCreateGroup(): boolean {
    if (!orgRole || !orgPolicy) return false;
    const wcc = orgPolicy.who_can_create_groups;
    if (wcc === "all") return true;
    if (wcc === "member") return true; // org メンバーであれば orgRole は必ず非 null
    if (wcc === "user_admin")
      return ["user_admin", "sys_admin", "owner"].includes(orgRole);
    if (wcc === "sys_admin_only")
      return ["sys_admin", "owner"].includes(orgRole);
    return false;
  }

  // サイドバーには所属グループのみ表示する（最大5件）
  const joinedGroups = groups.filter((g) => g.role !== null);
  // グループ一覧モーダル用に所属・未所属を分ける
  const unjoinedGroups = groups.filter((g) => g.role === null);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 pt-10 pb-6 px-3 flex flex-col gap-4">
      {/* 現在の組織名と操作ボタン */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2">
          <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            組織
          </span>
          <div className="flex items-center gap-1">
            {/* 組織作成ボタン: ログイン済みの全ユーザーに表示する */}
            {orgRole !== null && (
              <button
                onClick={() => setIsOrgCreateModalOpen(true)}
                className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
              >
                作成
              </button>
            )}
            {/* 組織切り替えボタン */}
            <button
              onClick={handleOpenOrgSwitchModal}
              className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
            >
              切り替え
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-800">
          <span className="text-base text-gray-700 dark:text-gray-300">
            {orgName}
          </span>
          {/* 組織管理へのリンク: owner / sys_admin / user_admin のみ表示する */}
          {orgRole &&
            ["owner", "sys_admin", "user_admin"].includes(orgRole) && (
              <Link
                href={`/organizations/${orgId}/admin`}
                className="text-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
                title="組織管理"
              >
                ⚙
              </Link>
            )}
        </div>
      </div>

      {/* グループ一覧: 所属グループを最大5件表示し、作成・一覧ボタンを提供する */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
            グループ
          </span>
          <div className="flex items-center gap-1">
            {/* グループ作成ボタン: 権限があるユーザーのみ表示する */}
            {canCreateGroup() && (
              <button
                onClick={() => setIsGroupCreateModalOpen(true)}
                className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
              >
                作成
              </button>
            )}
            {/* グループ一覧モーダルを開くボタン */}
            <button
              onClick={() => setIsGroupListModalOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
            >
              一覧
            </button>
          </div>
        </div>
        {joinedGroups.length > 0 && (
          <div className="flex flex-col gap-1.5 px-2">
            {joinedGroups.slice(0, 5).map((group) => {
              const isActive = String(group.id) === groupId;
              // グループ管理者またはグループ管理権限を持つ組織ロールであれば管理画面へのリンクを表示する
              const canManage =
                group.role === "admin" ||
                ["owner", "sys_admin", "user_admin"].includes(orgRole ?? "");
              return (
                <div
                  key={group.id}
                  className={`flex items-center gap-0.5 rounded transition-colors ${
                    isActive
                      ? "py-0.5 bg-gray-300 dark:bg-gray-600"
                      : "py-0.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {/* グループ名: ノート一覧ページへのリンク */}
                  <Link
                    href={`/organizations/${orgId}/groups/${group.id}/notes`}
                    className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 min-w-0 ${
                      isActive ? "font-semibold" : ""
                    }`}
                  >
                    <span className="truncate">{group.name}</span>
                    {/* 非公開グループにのみバッジを表示する */}
                    {group.is_private && (
                      <span className="shrink-0 text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                        非公開
                      </span>
                    )}
                  </Link>
                  {/* ⚙ アイコン: グループ管理者または組織管理者のみ表示する */}
                  {canManage && (
                    <Link
                      href={`/organizations/${orgId}/groups/${group.id}/admin`}
                      className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-1 rounded text-lg"
                      title={`${group.name} の管理`}
                    >
                      ⚙
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* キーワード検索フォーム */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
        className="flex flex-col gap-1.5"
      >
        <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
          ノート検索
        </span>
        <div className="flex gap-1">
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="タイトルで検索..."
            className="flex-1 min-w-0 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
          />
          <button
            type="submit"
            className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-base hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
          >
            検索
          </button>
        </div>
      </form>

      {/* タグフィルター: チェックボックス一覧 */}
      {availableTags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
            タグで絞り込み
          </span>
          <div className="flex flex-col gap-1 px-2">
            {availableTags.map((tag) => (
              <label
                key={tag}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => onTagToggle(tag)}
                  className="rounded border-gray-300 dark:border-gray-700"
                />
                <span className="text-base truncate">{tag}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 組織作成モーダル */}
      {isOrgCreateModalOpen && (
        <Modal title="組織を作成" onClose={handleCloseOrgCreateModal}>
          <form onSubmit={handleCreateOrg} className="flex flex-col gap-5">
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
              <p className="text-sm font-semibold">
                プライベートグループの作成
              </p>
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
      )}

      {/* 組織切り替えモーダル */}
      {isOrgSwitchModalOpen && (
        <Modal
          title="組織を選択"
          onClose={() => setIsOrgSwitchModalOpen(false)}
        >
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
                      onClick={() => setIsOrgSwitchModalOpen(false)}
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
      )}

      {/* グループ作成ウィザード */}
      {isGroupCreateModalOpen && (
        <Modal
          title="グループを作成"
          onClose={() => setIsGroupCreateModalOpen(false)}
        >
          <CreateGroupWizard
            orgId={orgId}
            onCreated={(group) => {
              // 作成者は自動的に admin になる
              setGroups((prev) => [
                ...prev,
                {
                  id: group.id,
                  name: group.name,
                  is_private: false,
                  role: "admin",
                },
              ]);
              setIsGroupCreateModalOpen(false);
              router.push(`/organizations/${orgId}/groups/${group.id}/notes`);
            }}
          />
        </Modal>
      )}

      {/* グループ一覧モーダル: 所属・未所属グループを表示する（作成フォームは独立モーダルに移動） */}
      {isGroupListModalOpen && (
        <Modal
          title="グループ一覧"
          onClose={() => setIsGroupListModalOpen(false)}
        >
          <div className="flex flex-col gap-6">
            {/* 所属グループ */}
            {joinedGroups.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-base font-semibold">所属グループ</h2>
                <ul className="flex flex-col gap-2">
                  {joinedGroups.map((group) => (
                    <li key={group.id}>
                      <Link
                        href={`/organizations/${orgId}/groups/${group.id}/notes`}
                        onClick={() => setIsGroupListModalOpen(false)}
                        className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base font-medium">
                            {group.name}
                          </span>
                          {group.is_private && (
                            <span className="text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                              非公開
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-400">
                          {ROLE_LABELS[group.role!] ?? group.role}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 未所属グループ */}
            {unjoinedGroups.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-base font-semibold">未所属グループ</h2>
                <ul className="flex flex-col gap-2">
                  {unjoinedGroups.map((group) => (
                    <li key={group.id}>
                      <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-medium">
                            {group.name}
                          </span>
                          {group.is_private && (
                            <span className="text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                              非公開
                            </span>
                          )}
                        </div>
                        {/* 参加申請ボタン（バックエンド未実装のため現在は無効） */}
                        <button
                          type="button"
                          disabled
                          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed"
                          title="この機能は近日公開予定です"
                        >
                          参加を申請する
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {groups.length === 0 && (
              <p className="text-gray-500 text-base">グループがありません。</p>
            )}
          </div>
        </Modal>
      )}
    </aside>
  );
}
