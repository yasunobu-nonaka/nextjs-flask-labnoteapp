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
 * タブ付きカード形式でフォルダーを表示する。
 * カード本体をクリックするとそのフォルダーに移動し、
 * ホバー時に右上のアクションボタンでリネーム・削除が可能。
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
        <div className="flex flex-col">
          {/* タブ（フォルダーの耳）*/}
          <div className="self-start ml-3 h-4 w-20 rounded-t-lg bg-amber-300 dark:bg-amber-700" />
          {/* リネームフォーム */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
            className="rounded-lg rounded-tl-none border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 flex flex-col gap-3 min-h-24"
          >
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-base bg-transparent border-b border-amber-400 dark:border-amber-600 focus:outline-none w-full"
            />
            <div className="flex gap-2 justify-end mt-auto">
              <button
                type="submit"
                className="text-sm text-blue-500 hover:underline"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(folder.name);
                }}
                className="text-sm text-gray-400 hover:underline"
              >
                ✕
              </button>
            </div>
          </form>
        </div>
      </li>
    );
  }

  return (
    <li className="group">
      <div className="flex flex-col">
        {/* タブ（フォルダーの耳） */}
        <div className="self-start ml-3 h-4 w-20 rounded-t-lg bg-amber-300 dark:bg-amber-700" />
        {/*
         * カード本体: 琥珀色でフォルダーらしさを演出。
         * 絶対配置のナビゲーションボタンがカード全体をクリック可能にし、
         * アクションボタン（z-10）がその上に重なる。
         */}
        <div className="relative rounded-lg rounded-tl-none border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 min-h-24 overflow-hidden">
          {/* カード全体をクリック可能にするナビゲーションボタン */}
          <button
            onClick={() => onNavigate(folder.id)}
            className="absolute inset-0 w-full h-full text-left p-4 flex items-end"
          >
            <span className="text-base font-medium truncate w-full">
              {folder.name}
            </span>
          </button>
          {/* ホバー時に右上に表示するアクションボタン */}
          <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
                setEditName(folder.name);
              }}
              title="名前を変更"
              className="p-1 text-sm rounded bg-amber-100 dark:bg-amber-900/80 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ✎
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              title="削除"
              className="p-1 text-sm rounded bg-amber-100 dark:bg-amber-900/80 text-gray-400 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
