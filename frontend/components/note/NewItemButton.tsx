"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * NewItemButton コンポーネント
 * 「新規作成」ボタンとドロップダウンメニューを提供する。
 * 「ノート」はノート作成ページへのリンク、「フォルダー」は onCreateFolder を呼んで
 * 親のフォルダー作成モーダルを開く。
 */
export default function NewItemButton({
  currentFolderId,
  notesBase,
  onCreateFolder,
}: {
  currentFolderId: number | null;
  notesBase: string;
  onCreateFolder: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const noteHref = currentFolderId
    ? `${notesBase}/new?folder_id=${currentFolderId}`
    : `${notesBase}/new`;

  return (
    <div className="relative">
      {/* 透明オーバーレイ: メニュー外クリックで閉じる */}
      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
      )}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 pl-4 pr-2 py-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
        ノート・フォルダー新規作成
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-32">
          {/* ノート作成ページへ遷移する */}
          <Link
            href={noteHref}
            className="block w-full text-left px-4 py-2 text-base hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setIsOpen(false)}
          >
            ノート
          </Link>
          {/* フォルダー作成モーダルを開く */}
          <button
            onClick={() => {
              setIsOpen(false);
              onCreateFolder();
            }}
            className="w-full text-left px-4 py-2 text-base hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            フォルダー
          </button>
        </div>
      )}
    </div>
  );
}
