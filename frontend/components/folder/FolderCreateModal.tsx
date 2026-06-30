"use client";

import { useState } from "react";
import { authFetch } from "@/lib/api";
import Modal from "@/components/common/Modal";

/**
 * FolderCreateModal コンポーネント
 * 現在のフォルダー位置に新規フォルダーを作成するモーダル。
 * 作成成功後は onCreated を呼び、親がフォルダー一覧を再フェッチする。
 */
export default function FolderCreateModal({
  isOpen,
  onClose,
  orgId,
  groupId,
  currentFolderId,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  orgId: number;
  groupId: number;
  currentFolderId: number | null;
  onCreated: () => void;
}) {
  const [folderName, setFolderName] = useState("");

  function handleClose() {
    setFolderName("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) return;
    const res = await authFetch(
      `/api/organizations/${orgId}/groups/${groupId}/folders`,
      {
        method: "POST",
        body: JSON.stringify({ name: trimmed, parent_id: currentFolderId }),
      },
    );
    if (res.ok) {
      handleClose();
      onCreated();
    }
  }

  if (!isOpen) return null;

  return (
    <Modal title="フォルダーを作成" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          autoFocus
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="フォルダー名"
          className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-base rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity"
          >
            作成
          </button>
        </div>
      </form>
    </Modal>
  );
}
