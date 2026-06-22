"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

type Group = {
  id: number;
  name: string;
  is_private: boolean;
  role: string | null;
};

type EditingValues = {
  name: string;
  is_private: boolean;
};

/**
 * 組織コンソール: グループ管理ページ。
 * グループ名・公開設定のインライン編集と削除ができる。
 *
 * 編集状態は editingGroupId で管理し、同時に1行のみ編集できる。
 * 別の行の編集を開始すると前の編集はキャンセルされる。
 */
export default function ConsoleGroupsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 編集中のグループ ID（null = 編集中なし）
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  // 編集中の入力値
  const [editingValues, setEditingValues] = useState<EditingValues>({
    name: "",
    is_private: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 名前入力欄にフォーカスを当てるための ref
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await authFetch(`/api/organizations/${orgId}/groups`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setFetchError("グループ一覧の取得に失敗しました");
          setLoading(false);
          return;
        }
        const data: Group[] = await res.json();
        setGroups(data);
      } catch {
        setFetchError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchGroups();
  }, [orgId, router]);

  // editingGroupId が変わったとき（編集開始時）に名前入力欄へフォーカスする
  useEffect(() => {
    if (editingGroupId !== null) {
      nameInputRef.current?.focus();
    }
  }, [editingGroupId]);

  /** 指定グループの編集モードを開始する */
  function startEditing(group: Group) {
    setSaveError(null);
    setEditingGroupId(group.id);
    setEditingValues({ name: group.name, is_private: group.is_private });
  }

  /** 編集をキャンセルして通常表示に戻る */
  function cancelEditing() {
    setEditingGroupId(null);
    setSaveError(null);
  }

  /** 編集内容を PATCH で保存する */
  async function handleSave(groupId: number) {
    const trimmedName = editingValues.name.trim();
    if (!trimmedName) {
      setSaveError("グループ名を入力してください");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${groupId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: trimmedName,
            is_private: editingValues.is_private,
          }),
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

      // 保存成功: groups state を更新して編集モードを終了する
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, name: trimmedName, is_private: editingValues.is_private }
            : g,
        ),
      );
      setEditingGroupId(null);
    } catch {
      setSaveError("サーバーへの接続に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  /** グループを削除する */
  async function handleDelete(group: Group) {
    if (
      !window.confirm(
        `グループ「${group.name}」を削除しますか？\nグループ内のノートとフォルダーもすべて削除されます。この操作は取り消せません。`,
      )
    )
      return;

    try {
      const res = await authFetch(
        `/api/organizations/${orgId}/groups/${group.id}`,
        { method: "DELETE" },
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const json = await res.json();
        alert(json.message ?? "削除に失敗しました");
        return;
      }
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      // 削除したグループを編集中だった場合は編集状態をクリアする
      if (editingGroupId === group.id) setEditingGroupId(null);
    } catch {
      alert("サーバーへの接続に失敗しました");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">グループ管理</h2>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : fetchError ? (
        <p className="text-red-500 text-sm">{fetchError}</p>
      ) : groups.length === 0 ? (
        <p className="text-gray-500">グループがありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => {
            const isEditing = editingGroupId === g.id;

            return (
              <li
                key={g.id}
                className="flex flex-col gap-2 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              >
                {isEditing ? (
                  /* 編集行 */
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* グループ名入力 */}
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={editingValues.name}
                        onChange={(e) =>
                          setEditingValues((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSave(g.id);
                          if (e.key === "Escape") cancelEditing();
                        }}
                        className="flex-1 min-w-0 px-3 py-1.5 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
                        placeholder="グループ名"
                      />
                      {/* 非公開チェックボックス */}
                      <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingValues.is_private}
                          onChange={(e) =>
                            setEditingValues((prev) => ({
                              ...prev,
                              is_private: e.target.checked,
                            }))
                          }
                          className="w-4 h-4"
                        />
                        非公開
                      </label>
                      {/* 保存・キャンセルボタン */}
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSave(g.id)}
                          disabled={isSaving}
                          className="px-3 py-1.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                        >
                          {isSaving ? "保存中..." : "保存"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={isSaving}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                    {/* 保存エラー */}
                    {saveError && (
                      <p className="text-sm text-red-500">{saveError}</p>
                    )}
                  </div>
                ) : (
                  /* 通常行 */
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base font-medium truncate">
                        {g.name}
                      </span>
                      {g.is_private && (
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                          非公開
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {g.role && (
                        <span className="text-sm text-gray-400">{g.role}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => startEditing(g)}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(g)}
                        className="text-sm text-red-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
