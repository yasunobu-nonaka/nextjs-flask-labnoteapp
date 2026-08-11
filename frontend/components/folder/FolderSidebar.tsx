"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import OrgCreateModal from "@/components/org/OrgCreateModal";
import OrgSwitchModal from "@/components/org/OrgSwitchModal";
import GroupCreateModal from "@/components/group/GroupCreateModal";
import GroupListModal, { type Group } from "@/components/group/GroupListModal";
import { type OrgPolicy } from "@/lib/types";

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
  /** 選択中の著者ID一覧 */
  selectedAuthorIds: number[];
  /** 選択肢として表示する著者（グループメンバー）一覧 */
  availableAuthors: { id: number; username: string }[];
  onAuthorAdd: (authorId: number) => void;
  onAuthorRemove: (authorId: number) => void;
};

/**
 * FolderSidebar コンポーネント
 * 現在の組織名・グループ一覧、キーワード検索フォーム、タグフィルターを表示する左サイドバー。
 * 「作成」ボタンで組織・グループの作成モーダルを開く。
 * 「切り替え」ボタンで組織一覧モーダル、「一覧」ボタンでグループ一覧モーダルを開く。
 * 各モーダルは専用コンポーネント（OrgCreateModal / OrgSwitchModal / GroupCreateModal / GroupListModal）に委任する。
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
  selectedAuthorIds,
  availableAuthors,
  onAuthorAdd,
  onAuthorRemove,
}: Props) {
  const [orgName, setOrgName] = useState("");
  const [orgRole, setOrgRole] = useState<string | null>(null);
  // 組織ポリシー（グループ作成権限の判定に使用する）
  const [orgPolicy, setOrgPolicy] = useState<OrgPolicy | null>(null);
  // 全グループ（所属・未所属）を保持し、描画時にフィルターする
  const [groups, setGroups] = useState<Group[]>([]);
  // ⋮ 管理メニューポップオーバーを開いているグループの ID（null なら全て閉じている）
  const [openAdminMenuGroupId, setOpenAdminMenuGroupId] = useState<
    number | null
  >(null);
  // 管理メニューポップオーバーの表示位置（⋮ ボタンの画面上の座標から算出する）
  const [adminMenuPosition, setAdminMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // モーダルの開閉状態
  const [isOrgCreateModalOpen, setIsOrgCreateModalOpen] = useState(false);
  const [isOrgSwitchModalOpen, setIsOrgSwitchModalOpen] = useState(false);
  const [isGroupCreateModalOpen, setIsGroupCreateModalOpen] = useState(false);
  const [isGroupListModalOpen, setIsGroupListModalOpen] = useState(false);

  const router = useRouter();

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
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 pt-4 pb-6 px-3 flex flex-col gap-4">
      {/* アプリロゴ: クリックするとホームへ戻る */}
      <div className="h-12 flex items-center px-2 pt-2 shrink-0">
        <Link
          href="/organizations"
          className="text-2xl font-bold tracking-tight hover:opacity-75 transition-opacity"
        >
          LabNoteApp
        </Link>
      </div>

      {/* 現在の組織名と操作ボタン */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-2 py-3">
          <span className="text-lg font-bold text-gray-700 dark:text-gray-300 truncate">
            {orgName}
          </span>
          {/* 組織切り替えボタン: 「<>」を 90 度回転させた形（上下のシェブロン）のアイコン */}
          <button
            onClick={() => setIsOrgSwitchModalOpen(true)}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded"
            title="組織を切り替え"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m7 15 5 5 5-5" />
              <path d="m7 9 5-5 5 5" />
            </svg>
          </button>
        </div>
        {/* 組織設定リンク: 組織メンバーに表示する */}
        {orgRole && (
          <Link
            href={`/organizations/${orgId}/admin`}
            className="flex items-center gap-1.5 pl-4 pr-2 py-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            組織設定
          </Link>
        )}
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
              return (
                <div
                  key={group.id}
                  className={clsx(
                    "group flex items-center gap-0.5 rounded transition-colors py-0.5",
                    isActive
                      ? "bg-gray-300 dark:bg-gray-600"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700",
                  )}
                >
                  {/* グループ名: ノート一覧ページへのリンク */}
                  <Link
                    href={`/organizations/${orgId}/groups/${group.id}/notes`}
                    className={clsx(
                      "flex-1 flex items-center gap-1.5 px-2 py-1.5 min-w-0",
                      isActive && "font-semibold",
                    )}
                  >
                    <span className="truncate">{group.name}</span>
                    {/* 非公開グループにのみバッジを表示する */}
                    {group.is_private && (
                      <span className="shrink-0 text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                        非公開
                      </span>
                    )}
                  </Link>
                  {/* ⋮ 管理メニュー: 行にホバーしたとき、またはメニューが開いているときに表示する */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (openAdminMenuGroupId === group.id) {
                        setOpenAdminMenuGroupId(null);
                        return;
                      }
                      // ⋮ ボタンの画面上の座標からポップオーバーの表示位置を算出する
                      const rect = e.currentTarget.getBoundingClientRect();
                      setAdminMenuPosition({
                        top: rect.top,
                        left: rect.right + 4,
                      });
                      setOpenAdminMenuGroupId(group.id);
                    }}
                    className={clsx(
                      "shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-1 rounded text-lg leading-none group-hover:opacity-100",
                      openAdminMenuGroupId === group.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                    title={`${group.name} の管理`}
                  >
                    ⋮
                  </button>

                  {/*
                   * 管理メニューポップオーバー: <aside> の overflow-y-auto によるクリッピングや
                   * 右カラム側の要素との重なりを避けるため、document.body に直接ポータルする
                   * （Modal / ConfirmModal と同じ考え方。詳細は CLAUDE.md 参照）。
                   * 通常の absolute 配置ではなく、ボタンの座標を基準にした fixed 配置になる。
                   */}
                  {openAdminMenuGroupId === group.id &&
                    adminMenuPosition &&
                    createPortal(
                      <>
                        {/* 透明オーバーレイ: メニュー外のクリックを検知して閉じる */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenAdminMenuGroupId(null)}
                        />
                        {/* 管理ページへのリンク一覧 */}
                        <div
                          className="fixed z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-max"
                          style={{
                            top: adminMenuPosition.top,
                            left: adminMenuPosition.left,
                          }}
                        >
                          <Link
                            href={`/organizations/${orgId}/groups/${group.id}/admin`}
                            onClick={() => setOpenAdminMenuGroupId(null)}
                            className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            基本設定
                          </Link>
                          <Link
                            href={`/organizations/${orgId}/groups/${group.id}/admin/members`}
                            onClick={() => setOpenAdminMenuGroupId(null)}
                            className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            メンバー管理
                          </Link>
                          <Link
                            href={`/organizations/${orgId}/groups/${group.id}/admin/policy`}
                            onClick={() => setOpenAdminMenuGroupId(null)}
                            className="block px-4 py-2 text-base whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            ポリシー管理
                          </Link>
                        </div>
                      </>,
                      document.body,
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

      {/* 著者フィルター: ドロップダウンで選択したメンバーをチップとして下に追加していく */}
      {availableAuthors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
            著者で絞り込み
          </span>
          <div className="px-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onAuthorAdd(Number(e.target.value));
                }
              }}
              className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
            >
              <option value="">著者を選択...</option>
              {availableAuthors
                .filter((author) => !selectedAuthorIds.includes(author.id))
                .map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.username}
                  </option>
                ))}
            </select>
          </div>
          {selectedAuthorIds.length > 0 && (
            <div className="flex flex-wrap gap-1 px-2">
              {selectedAuthorIds.map((id) => {
                const author = availableAuthors.find((a) => a.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onAuthorRemove(id)}
                    title="クリックで除外"
                    className="px-2 py-0.5 rounded-full bg-foreground text-background text-sm"
                  >
                    {author?.username ?? id} ×
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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
      <OrgCreateModal
        isOpen={isOrgCreateModalOpen}
        onClose={() => setIsOrgCreateModalOpen(false)}
        onCreated={(org) => router.push(`/organizations/${org.id}/groups`)}
      />

      {/* 組織切り替えモーダル */}
      <OrgSwitchModal
        isOpen={isOrgSwitchModalOpen}
        onClose={() => setIsOrgSwitchModalOpen(false)}
        onCreateClick={() => {
          setIsOrgSwitchModalOpen(false);
          setIsOrgCreateModalOpen(true);
        }}
      />

      {/* グループ作成モーダル */}
      <GroupCreateModal
        orgId={orgId}
        isOpen={isGroupCreateModalOpen}
        onClose={() => setIsGroupCreateModalOpen(false)}
        onCreated={(group) => {
          // 作成者は自動的に admin になる
          setGroups((prev) => [
            ...prev,
            {
              id: group.id,
              name: group.name,
              is_private: false,
              role: "admin",
              join_status: "active",
              policy: null,
            },
          ]);
          setIsGroupCreateModalOpen(false);
          router.push(`/organizations/${orgId}/groups/${group.id}/notes`);
        }}
      />

      {/* グループ一覧モーダル */}
      <GroupListModal
        orgId={orgId}
        isOpen={isGroupListModalOpen}
        onClose={() => setIsGroupListModalOpen(false)}
        joinedGroups={joinedGroups}
        unjoinedGroups={unjoinedGroups}
        onImmediateJoin={(joinedGroupId) => {
          // 即時参加: グループリストを更新してモーダルを閉じ、グループページへ遷移する
          setGroups((prev) =>
            prev.map((g) =>
              g.id === joinedGroupId
                ? { ...g, role: "editor", join_status: "active" }
                : g,
            ),
          );
          setIsGroupListModalOpen(false);
          router.push(`/organizations/${orgId}/groups/${joinedGroupId}/notes`);
        }}
        onCancelledRequest={(cancelledGroupId) => {
          // 申請キャンセル: join_status を null にリセットする
          setGroups((prev) =>
            prev.map((g) =>
              g.id === cancelledGroupId ? { ...g, join_status: null } : g,
            ),
          );
        }}
      />
    </aside>
  );
}
