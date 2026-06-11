"use client";

import { useState } from "react";
import { authFetch } from "@/lib/api";
import { type Folder } from "@/lib/folders";

type Props = {
  folder: Folder;
  /** フォルダーに移動するハンドラ */
  onNavigate: (id: number) => void;
  /** フォルダーの CRUD 操作後に全フォルダーを再取得するハンドラ */
  onMutation: () => void;
};

/**
 * FolderCard コンポーネント
 * ノート一覧内にフォルダーをカード形式で表示する。
 * クリックすると onNavigate でそのフォルダーに移動する。
 * ホバー時にリネーム・削除ボタンを表示する。
 */
export default function FolderCard({ folder, onNavigate, onMutation }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  async function handleRename() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const res = await authFetch(`/api/folders/${folder.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setIsEditing(false);
      onMutation();
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `「${folder.name}」を削除しますか？フォルダー内のノートと子フォルダーも削除されます。`
      )
    )
      return;
    const res = await authFetch(`/api/folders/${folder.id}`, {
      method: "DELETE",
    });
    if (res.ok) onMutation();
  }

  if (isEditing) {
    return (
      <li>
        {/* リネームフォーム */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRename();
          }}
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
        >
          <span className="text-xs text-gray-400 shrink-0">フォルダー</span>
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 px-2 py-0.5 text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none"
          />
          <button
            type="submit"
            className="text-xs text-blue-500 hover:underline shrink-0"
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setEditName(folder.name);
            }}
            className="text-xs text-gray-400 hover:underline shrink-0"
          >
            ✕
          </button>
        </form>
      </li>
    );
  }

  return (
    <li>
      {/*
       * フォルダーカード本体
       * ホバーで右端のアクションボタンを表示する。
       * クリック領域（ボタン）はフォルダー名と矢印を含む。
       */}
      <div className="group flex items-center rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-gray-50 dark:bg-gray-900/50">
        <button
          onClick={() => onNavigate(folder.id)}
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left"
        >
          <span className="text-xs font-mono text-gray-400 shrink-0">DIR</span>
          <span className="text-sm font-medium">{folder.name}</span>
          <span className="ml-auto text-gray-400 text-sm shrink-0">›</span>
        </button>
        {/* ホバー時のみ表示するアクションボタン */}
        <div className="hidden group-hover:flex items-center gap-0.5 px-2 shrink-0">
          <button
            onClick={() => {
              setIsEditing(true);
              setEditName(folder.name);
            }}
            title="名前を変更"
            className="p-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✎
          </button>
          <button
            onClick={handleDelete}
            title="削除"
            className="p-1 text-xs text-gray-400 hover:text-red-500"
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  );
}
