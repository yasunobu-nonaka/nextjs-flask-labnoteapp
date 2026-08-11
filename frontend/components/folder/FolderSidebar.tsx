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
import { type Group } from "@/components/group/GroupListModal";
import NewItemButton from "@/components/note/NewItemButton";
import NoteSearchModal from "@/components/note/NoteSearchModal";
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
  /** 新規作成ボタン用: 現在のフォルダー ID（ノート作成時の folder_id クエリに使う） */
  currentFolderId: number | null;
  /** 新規作成ボタン用: ノート一覧ページのベース URL */
  notesBase: string;
  /** 新規作成ボタン用: フォルダー作成モーダルを開くハンドラ */
  onCreateFolder: () => void;
};

/**
 * FolderSidebar コンポーネント
 * 現在の組織名・新規作成ボタン・ノート検索 & 絞り込みボタン・組織設定リンク・グループ一覧を表示する左サイドバー。
 * キーワード検索・著者フィルター・タグフィルターは NoteSearchModal に集約している。
 * グループ一覧は所属・未所属を問わず全件表示する（別モーダルへの切り出しは廃止）。
 * 未所属グループは join_method に応じて参加ボタン（即時参加/申請）または「招待制」バッジを出し分ける。
 * 組織名右の切り替えアイコンで組織一覧モーダルを開く
 * （組織・グループの作成モーダルは、それぞれのモーダル自身のヘッダーから開く）。
 * 各モーダルは専用コンポーネント（OrgCreateModal / OrgSwitchModal / GroupCreateModal）に委任する。
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
  currentFolderId,
  notesBase,
  onCreateFolder,
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
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // 未所属グループの参加処理状態（グループ ID ごと）
  const [joinStatusMap, setJoinStatusMap] = useState<
    Map<number, "idle" | "requesting" | "requested" | "canceling">
  >(new Map());
  const [joinErrorMap, setJoinErrorMap] = useState<Map<number, string>>(
    new Map(),
  );

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

  // グループへの参加申請または即時参加を行う
  async function handleJoinGroup(targetGroupId: number) {
    setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "requesting"));
    setJoinErrorMap((prev) => {
      const m = new Map(prev);
      m.delete(targetGroupId);
      return m;
    });
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${targetGroupId}/join`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "idle"));
        setJoinErrorMap((prev) =>
          new Map(prev).set(targetGroupId, data.message ?? "参加に失敗しました"),
        );
        return;
      }
      if (data.result === "joined") {
        // 即時参加: 一覧を更新してそのグループのノート一覧へ遷移する
        setGroups((prev) =>
          prev.map((g) =>
            g.id === targetGroupId
              ? { ...g, role: "editor", join_status: "active" }
              : g,
          ),
        );
        router.push(`/organizations/${orgId}/groups/${targetGroupId}/notes`);
      } else {
        setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "requested"));
      }
    } catch {
      setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "idle"));
      setJoinErrorMap((prev) =>
        new Map(prev).set(targetGroupId, "サーバーへの接続に失敗しました"),
      );
    }
  }

  // グループへの参加申請をキャンセルする
  async function handleCancelJoinGroup(targetGroupId: number) {
    setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "canceling"));
    setJoinErrorMap((prev) => {
      const m = new Map(prev);
      m.delete(targetGroupId);
      return m;
    });
    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${targetGroupId}/join`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "requested"));
        setJoinErrorMap((prev) =>
          new Map(prev).set(
            targetGroupId,
            data.message ?? "キャンセルに失敗しました",
          ),
        );
        return;
      }
      setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "idle"));
      setGroups((prev) =>
        prev.map((g) =>
          g.id === targetGroupId ? { ...g, join_status: null } : g,
        ),
      );
    } catch {
      setJoinStatusMap((prev) => new Map(prev).set(targetGroupId, "requested"));
      setJoinErrorMap((prev) =>
        new Map(prev).set(targetGroupId, "サーバーへの接続に失敗しました"),
      );
    }
  }

  // 所属・未所属を問わず全グループを表示する
  const joinedGroups = groups.filter((g) => g.role !== null);
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
        {/* 新規作成ボタン: ノート・フォルダーの作成ポップオーバー */}
        <NewItemButton
          currentFolderId={currentFolderId}
          notesBase={notesBase}
          onCreateFolder={onCreateFolder}
        />
        {/* ノート検索 & 絞り込みボタン: キーワード・タグ・著者の条件設定モーダルを開く */}
        <button
          onClick={() => setIsSearchModalOpen(true)}
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          ノート検索 & 絞り込み
        </button>
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

      {/* グループ一覧: 所属・未所属を含む全グループを表示し、作成ボタンを提供する */}
      <div className="flex flex-col gap-1 mt-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
            グループ
          </span>
          {/* グループ作成ボタン: 権限があるユーザーのみ表示する */}
          {canCreateGroup() && (
            <button
              onClick={() => setIsGroupCreateModalOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
            >
              作成
            </button>
          )}
        </div>
        {joinedGroups.length > 0 && (
          <div className="flex flex-col gap-1.5 px-2">
            {joinedGroups.map((group) => {
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
                      "flex-1 flex items-center gap-1.5 px-2 py-1 min-w-0",
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
        {/* 未所属グループ: join_method に応じて参加ボタン/招待制バッジを出し分ける */}
        {unjoinedGroups.length > 0 && (
          <div className="flex flex-col gap-1.5 px-2 mt-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              未参加のグループ
            </span>
            {unjoinedGroups.map((group) => {
              const joinMethod = group.policy?.join_method ?? "invite_only";
              const status =
                joinStatusMap.get(group.id) ??
                (group.join_status === "pending" ? "requested" : "idle");
              const error = joinErrorMap.get(group.id);
              return (
                <div key={group.id} className="flex flex-col gap-0.5 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 flex items-center gap-1.5 px-2 py-1 min-w-0">
                      <span className="truncate text-gray-500 dark:text-gray-400">
                        {group.name}
                      </span>
                      {group.is_private && (
                        <span className="shrink-0 text-xs text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1">
                          非公開
                        </span>
                      )}
                    </div>
                    {joinMethod === "invite_only" ? (
                      <span className="shrink-0 text-xs text-gray-400 pr-2">
                        招待制
                      </span>
                    ) : status === "requested" || status === "canceling" ? (
                      <button
                        type="button"
                        disabled={status === "canceling"}
                        onClick={() => handleCancelJoinGroup(group.id)}
                        className="shrink-0 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors pr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {status === "canceling" ? "キャンセル中..." : "申請済み ×"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={status === "requesting"}
                        onClick={() => handleJoinGroup(group.id)}
                        className="shrink-0 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors pr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {status === "requesting"
                          ? "処理中..."
                          : joinMethod === "open"
                            ? "参加"
                            : "申請"}
                      </button>
                    )}
                  </div>
                  {error && (
                    <p className="px-2 text-xs text-red-500">{error}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      {/* ノート検索 & 絞り込みモーダル */}
      <NoteSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        query={query}
        onQueryChange={onQueryChange}
        onSearch={onSearch}
        selectedTags={selectedTags}
        availableTags={availableTags}
        onTagToggle={onTagToggle}
        selectedAuthorIds={selectedAuthorIds}
        availableAuthors={availableAuthors}
        onAuthorAdd={onAuthorAdd}
        onAuthorRemove={onAuthorRemove}
      />
    </aside>
  );
}
