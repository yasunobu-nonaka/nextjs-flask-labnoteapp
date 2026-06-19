"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Link from "next/link";

type Props = {
  /** キーワード検索: 入力中の文字列 */
  orgId: string;
  groupId: string;
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
};

type Organization = {
  id: number;
  name: string;
  role: string;
};

/**
 * FolderSidebar コンポーネント
 * 現在の組織名・グループ一覧、キーワード検索フォーム、タグフィルターを表示する左サイドバー。
 * フォルダーナビゲーションはメインコンテンツ側の FolderCard / ブレッドクラムで行う。
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isGroupCreateModalOpen, setIsGroupCreateModalOpen] = useState(false);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const router = useRouter();

  // 新規グループ作成フォームの入力値と送信状態
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
          const data = await res.json();
          setGroups(data);
        }
      } catch (err) {
        console.error("グループ一覧の取得に失敗しました", err);
      }
    }
    fetchGroups();
  }, [orgId, router]);

  /** 組織切り替えモーダルを開く。初回のみ組織一覧を取得する。 */
  async function handleOpenOrgModal() {
    setIsOrgModalOpen(true);
    if (orgs.length > 0) return;

    setOrgsLoading(true);
    setOrgsError(null);
    try {
      const res = await authFetch(`/api/organizations`);

      if (res.ok) {
        const data = await res.json();
        setOrgs(data);
      } else {
        setOrgsError("組織一覧の取得に失敗しました");
      }
    } catch {
      setOrgsError("サーバーへの接続に失敗しました");
    } finally {
      setOrgsLoading(false);
    }
  }

  // グループを新規作成してリストに追加する
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await authFetch(`/api/organizations/${orgId}/groups`, {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const json = await res.json();
        setCreateError(json.message ?? "作成に失敗しました");
        return;
      }
      const data = await res.json();
      setGroups((prev) => [...prev, { ...data.group, role: "admin" }]);
      setNewGroupName("");
      router.push(`/organizations/${orgId}/groups/${data.group.id}/notes`);
    } catch {
      setCreateError("サーバーへの接続に失敗しました");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 pt-10 pb-6 px-3 flex flex-col gap-4">
      {/* 現在の組織名と切り替えボタン */}
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
          組織
        </span>
        <div className="flex items-center justify-between px-2">
          <span className="text-base text-gray-700 dark:text-gray-300">
            {orgName}
          </span>
          {/* 組織切り替えボタン */}
          <button
            onClick={handleOpenOrgModal}
            className="text-sm dark:text-base text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
          >
            ▽
          </button>
        </div>
      </div>

      {/* グループ一覧: 最大5件、現在のグループをハイライト */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
            グループ
          </span>
          <button
            className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors px-2 py-1 rounded"
            onClick={() => setIsGroupCreateModalOpen(true)}
          >
            +
          </button>
        </div>
        {groups.length > 0 && (
          <div className="flex flex-col gap-1 px-2">
            {groups.slice(0, 5).map((group) => (
              <Link
                key={group.id}
                href={`/organizations/${orgId}/groups/${group.id}/notes`}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors ${
                  String(group.id) === groupId
                    ? "bg-gray-200 dark:bg-gray-700 font-semibold"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {group.name}
              </Link>
            ))}
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

      {/* 組織切り替えモーダル */}
      {isOrgModalOpen && (
        <Modal title="組織を選択" onClose={() => setIsOrgModalOpen(false)}>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">所属組織</h2>
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
                    {/* 組織カード: クリックでグループ一覧へ遷移する */}
                    <Link
                      href={`/organizations/${org.id}/groups`}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all"
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

      {/* グループ作成モーダル */}
      {isGroupCreateModalOpen && (
        <Modal
          title="グループを作成"
          onClose={() => {
            setIsGroupCreateModalOpen(false);
            setNewGroupName("");
            setCreateError(null);
          }}
        >
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <input
              autoFocus
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="グループ名"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
            />
            {createError && (
              <p className="text-sm text-red-500">{createError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsGroupCreateModalOpen(false);
                  setNewGroupName("");
                  setCreateError(null);
                }}
                className="px-4 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isCreating || !newGroupName.trim()}
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {isCreating ? "作成中..." : "作成"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </aside>
  );
}
