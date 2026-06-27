"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { authFetch } from "@/lib/api";
import { type Folder, buildFolderOptions } from "@/lib/folders";
import Modal from "@/components/Modal";
import ConfirmModal from "@/components/ConfirmModal";
import NoteShareModal from "@/components/NoteShareModal";
import { formatDate } from "@/lib/utils";

export type PrivateMember = {
  user_id: number;
  username: string;
  role: string;
};

export type Note = {
  id: number;
  title: string;
  content_md: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  folder_id: number | null;
  is_private: boolean;
  is_owner: boolean;
  private_members: PrivateMember[];
};

/**
 * NoteCard コンポーネント
 * ノートを紙風のカード形式で表示する。
 * タイトルをリンクとして表示し、タグはクリックでフィルター ON/OFF。
 * ··· ボタンでフォルダー移動・共有メニューを開く。
 * プライベートノートには鍵アイコンのバッジを表示する。
 */
export default function NoteCard({
  note,
  orgId,
  groupId,
  selectedTags,
  onTagToggle,
  folders,
  onMoved,
  onDeleted,
}: {
  note: Note;
  orgId: number;
  groupId: number;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  folders: Folder[];
  onMoved: () => void;
  onDeleted: () => void;
}) {
  // カードの表示モードを4状態で管理する
  //   idle    : 通常表示
  //   menu    : ··· ボタンを押したときのドロップダウン表示
  //   moving  : フォルダー移動フォームの表示
  //   sharing : プライベートノートのメンバー共有モーダル
  const [mode, setMode] = useState<"idle" | "menu" | "moving" | "sharing">("idle");
  // 削除確認モーダルの表示フラグ
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  // 移動先フォルダーの選択値（null = フォルダーなし）
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
  // 共有後にカード内の private_members を更新するためのローカルコピー
  const [privateMembers, setPrivateMembers] = useState<PrivateMember[]>(
    note.private_members ?? [],
  );

  const date = formatDate(note.updated_at);
  const notesBase = `/organizations/${orgId}/groups/${groupId}/notes`;

  async function handleDelete() {
    const res = await authFetch(
      `/api/organizations/${orgId}/groups/${groupId}/notes/${note.id}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      onDeleted();
    }
  }

  async function handleMove() {
    const res = await authFetch(
      `/api/organizations/${orgId}/groups/${groupId}/notes/${note.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ folder_id: targetFolderId }),
      },
    );
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
    <li className="relative isolate flex flex-col gap-2 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow aspect-3/4">
      {/* 罫線オーバーレイ: mx-4 で左右に余白を持たせてノート風の横罫線を表示する。
          isolate + [z-index:-1] でテキストより背面に配置する。 */}
      <div className="absolute inset-0 mx-4 pointer-events-none z-[-1] bg-[repeating-linear-gradient(transparent,transparent_23px,#f0f1f4_23px,#f0f1f4_24px)] dark:bg-[repeating-linear-gradient(transparent,transparent_23px,#2b3544_23px,#2b3544_24px)]" />

      {/* プライベートノートの鍵アイコンバッジ（左上） */}
      {note.is_private && (
        <span
          className="absolute top-2 left-2 text-gray-400 dark:text-gray-500"
          title="非公開ノート"
          aria-label="非公開"
        >
          {/* 鍵アイコン（SVG） */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3.5 h-3.5"
          >
            <path
              fillRule="evenodd"
              d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5V4.5a2 2 0 1 0-4 0V6h4Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}

      {/* ドロップダウンメニュー: 透明オーバーレイ + メニュー本体 */}
      {mode === "menu" && (
        <>
          {/* 透明オーバーレイ: メニュー外のクリックを検知して閉じる */}
          <div className="fixed inset-0 z-10" onClick={() => setMode("idle")} />
          <div className="absolute right-4 top-10 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-36">
            {/* フォルダー移動 */}
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
            {/* 共有メニュー: プライベートノートのオーナーのみ表示 */}
            {note.is_private && note.is_owner && (
              <button
                onClick={() => setMode("sharing")}
                className="w-full text-left px-4 py-2 text-base hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                他メンバーに共有
              </button>
            )}
            {/* 削除 */}
            <button
              onClick={() => { setMode("idle"); setIsDeleteConfirmOpen(true); }}
              className="w-full text-left px-4 py-2 text-base text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
            >
              削除
            </button>
          </div>
        </>
      )}

      {/* ··· メニューボタン（右上に固定） */}
      <button
        onClick={() => setMode(mode === "menu" ? "idle" : "menu")}
        className="absolute top-3 right-3 px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:font-bold text-base leading-none"
        title="メニュー"
      >
        ···
      </button>

      {/* タイトルリンク: 3行で折り返しを止めて省略 */}
      <Link
        href={`${notesBase}/${note.id}`}
        className="font-semibold text-base leading-snug hover:underline pr-6 line-clamp-3"
      >
        {note.title}
      </Link>

      {/* フレキシブルスペーサー: 下部コンテンツをカード底部に固定する */}
      <div className="flex-1" />

      {/* タグ一覧: 最大3件を表示し、超過分は「他X件」ボタンでポップオーバー表示 */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 overflow-hidden">
          {note.tags.slice(0, 3).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagToggle(tag)}
              className={clsx(
                "px-2 py-0.5 text-base rounded-full transition-colors max-w-32 truncate",
                selectedTags.includes(tag)
                  ? "bg-foreground text-background"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
              )}
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
                    className={clsx(
                      "px-2 py-0.5 text-base rounded-full transition-colors",
                      selectedTags.includes(tag)
                        ? "bg-foreground text-background"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
                    )}
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

      {/* 削除確認モーダル */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="ノートを削除"
        message={`「${note.title}」を削除しますか？\nこの操作は取り消せません。`}
        confirmLabel="削除"
        variant="danger"
        onConfirm={() => { setIsDeleteConfirmOpen(false); handleDelete(); }}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />

      {/* 共有メンバー管理モーダル */}
      <NoteShareModal
        isOpen={mode === "sharing"}
        onClose={() => setMode("idle")}
        noteId={note.id}
        orgId={orgId}
        groupId={groupId}
        notesBase={notesBase}
        privateMembers={privateMembers}
        onUpdated={setPrivateMembers}
      />
    </li>
  );
}
