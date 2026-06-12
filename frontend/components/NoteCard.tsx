"use client";

import { useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import { type Folder, buildFolderOptions } from "@/lib/folders";
import Modal from "@/components/Modal";

export type Note = {
  id: number;
  title: string;
  content_md: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  folder_id: number | null;
};

/**
 * NoteCard コンポーネント
 * ノートを紙風のカード形式で表示する。
 * タイトルをリンクとして表示し、タグはクリックでフィルター ON/OFF。
 * ··· ボタンでフォルダー移動メニューを開く。
 */
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
    /*
     * カード本体: 紙風デザイン。
     * shadow-sm + hover:shadow-md で浮き上がり感を演出。
     * flex-col で内部要素を縦に並べ、下部に日付・タグを固定する。
     */
    <li className="relative flex flex-col gap-2 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow aspect-3/4">
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

      {/* ··· メニューボタン（右上に固定） */}
      <button
        onClick={() => setMode(mode === "menu" ? "idle" : "menu")}
        className="absolute top-3 right-3 px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-base leading-none"
        title="メニュー"
      >
        ···
      </button>

      {/* タイトルリンク: 3行で折り返しを止めて省略 */}
      <Link
        href={`/notes/${note.id}`}
        className="font-semibold text-base leading-snug hover:underline pr-6 line-clamp-3"
      >
        {note.title}
      </Link>

      {/* フレキシブルスペーサー: 下部コンテンツをカード底部に固定する */}
      <div className="flex-1" />

      {/* タグ一覧: 最大2件を表示し、超過分は「他X件」ボタンでポップオーバー表示 */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {note.tags.slice(0, 3).map((tag) => (
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
          {/* 3件目以降はポップオーバーで表示 */}
          {note.tags.length > 3 && (
            <div className="relative group">
              <button
                type="button"
                className="px-2 py-0.5 text-base rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                他{note.tags.length - 3}件
              </button>
              {/* ホバーで表示される非表示タグのポップオーバー */}
              <div className="hidden group-hover:flex absolute bottom-full left-0 mb-1 z-30 flex-wrap gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 min-w-32 max-w-48">
                {note.tags.slice(3).map((tag) => (
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
            </div>
          )}
        </div>
      )}

      {/* カード下部: 更新日 */}
      <span className="text-sm text-gray-400">{date}</span>

      {/* フォルダー移動モーダル */}
      {mode === "moving" && (
        <Modal title="フォルダーへ移動" onClose={() => setMode("idle")}>
          <select
            value={targetFolderId ?? ""}
            onChange={(e) =>
              setTargetFolderId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none text-base"
          >
            <option value="">Root（ルート）</option>
            {buildFolderOptions(folders).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMode("idle")}
              className="px-4 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleMove}
              className="px-4 py-2 text-base rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity"
            >
              移動
            </button>
          </div>
        </Modal>
      )}
    </li>
  );
}
