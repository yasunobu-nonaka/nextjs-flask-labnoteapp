"use client";

import { useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import { type Folder, buildFolderOptions } from "@/lib/folders";

export type Note = {
  id: number;
  title: string;
  content_md: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  folder_id: number | null;
};

export default function NoteCard({
  note,
  selectedTags,
  onTagToggle,
  folders,
  onMoved,
}: {
  note: Note;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  folders: Folder[];
  onMoved: () => void;
}) {
  // カードの表示モードを3状態で管理する
  //   idle   : 通常表示
  //   menu   : ··· ボタンを押したときのドロップダウン表示
  //   moving : フォルダー移動フォームの表示
  const [mode, setMode] = useState<"idle" | "menu" | "moving">("idle");
  // 移動先フォルダーの選択値（null = フォルダーなし）
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);

  const date = new Date(note.updated_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleMove() {
    const res = await authFetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      body: JSON.stringify({ folder_id: targetFolderId }),
    });
    if (res.ok) {
      setMode("idle");
      onMoved();
    }
  }

  return (
    <li className="relative flex flex-col gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
      {/* ドロップダウンメニュー: 透明オーバーレイ + メニュー本体 */}
      {mode === "menu" && (
        <>
          {/* 透明オーバーレイ: メニュー外のクリックを検知して閉じる */}
          <div className="fixed inset-0 z-10" onClick={() => setMode("idle")} />
          <div className="absolute right-4 top-10 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-36">
            <button
              onClick={() => {
                // 現在のフォルダーを初期値として移動フォームを開く
                setTargetFolderId(note.folder_id);
                setMode("moving");
              }}
              className="w-full text-left px-4 py-2 text-base hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              移動
            </button>
          </div>
        </>
      )}

      {/* ヘッダー行: タイトルリンク・更新日・メニューボタン */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/notes/${note.id}`}
          className="font-semibold text-lg leading-snug hover:underline"
        >
          {note.title}
        </Link>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <span className="text-base text-gray-400">{date}</span>
          <button
            onClick={() => setMode(mode === "menu" ? "idle" : "menu")}
            className="px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-base leading-none"
            title="メニュー"
          >
            ···
          </button>
        </div>
      </div>

      {/* フォルダー移動フォーム: 移動先選択 + 実行・キャンセルボタン */}
      {mode === "moving" && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={targetFolderId ?? ""}
            onChange={(e) =>
              setTargetFolderId(e.target.value ? Number(e.target.value) : null)
            }
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 focus:outline-none"
          >
            <option value="">Home</option>
            {buildFolderOptions(folders).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleMove}
            className="px-3 py-1 text-base rounded bg-foreground text-background hover:opacity-80 transition-opacity"
          >
            移動
          </button>
          <button
            onClick={() => setMode("idle")}
            className="px-3 py-1 text-base rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            キャンセル
          </button>
        </div>
      )}

      {/* タグ一覧: クリックでフィルター ON/OFF */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagToggle(tag)}
              className={`px-2 py-0.5 text-base rounded-full transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-foreground text-background"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
