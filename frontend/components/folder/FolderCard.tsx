"use client";

import { useState } from "react";
import { authFetch } from "@/lib/api";
import { type Folder } from "@/lib/folders";
import Modal from "@/components/common/Modal";

type Props = {
  folder: Folder;
  orgId: number;
  groupId: number;
  /** フォルダーに移動するハンドラ */
  onNavigate: (id: number) => void;
  /** フォルダーの CRUD 操作後に全フォルダーを再取得するハンドラ */
  onMutation: () => void;
};

/**
 * FolderCard コンポーネント
 * タブ付きカード形式でフォルダーを表示する。
 * カード本体をクリックするとそのフォルダーに移動する。
 * 右上の ··· ボタンでポップオーバーメニューを開き、名称変更・削除を行う。
 * 名称変更はモーダルで入力する。
 */
export default function FolderCard({
  folder,
  orgId,
  groupId,
  onNavigate,
  onMutation,
}: Props) {
  // ··· メニューポップオーバーの開閉
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // 名称変更モーダルの開閉と入力値
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  // 削除確認モーダルの開閉
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  async function handleRename() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const res = await authFetch(
      `/api/organizations/${orgId}/groups/${groupId}/folders/${folder.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      },
    );
    if (res.ok) {
      setIsRenameModalOpen(false);
      onMutation();
    }
  }

  async function handleDelete() {
    const res = await authFetch(
      `/api/organizations/${orgId}/groups/${groupId}/folders/${folder.id}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setIsDeleteModalOpen(false);
      onMutation();
    }
  }

  return (
    <li>
      <div className="flex flex-col">
        {/* タブ（フォルダーの耳） */}
        <div className="self-start h-4 w-20 rounded-t-lg bg-yellow-400 dark:bg-yellow-600" />
        {/*
         * カード本体: relative を持ち、絶対配置の子要素の基準点になる。
         * overflow-hidden を外しているのは、··· メニューのドロップダウンが
         * カード下端を超えて表示できるようにするため。
         */}
        <div className="relative rounded-lg rounded-tl-none border border-yellow-400 dark:border-yellow-700 bg-yellow-300 bg-linear-to-br from-yellow-300 via-yellow-300 to-yellow-400 dark:bg-linear-to-br dark:from-yellow-500 dark:via-yellow-500 dark:to-yellow-600 aspect-4/3">
          {/* カード全体をクリック可能にするナビゲーションボタン */}
          <button
            onClick={() => onNavigate(folder.id)}
            className="absolute inset-0 w-full h-full text-left p-4 flex items-end"
          >
            <span className="text-base dark:text-gray-800 font-medium truncate w-full">
              {folder.name}
            </span>
          </button>

          {/*
           * ドロップダウンメニュー: 透明オーバーレイとメニュー本体。
           * ··· ボタンより先に DOM に置くことで、ボタンが重なったとき
           * 後から描画される ··· ボタンが上に表示されるようにしている。
           */}
          {isMenuOpen && (
            <>
              {/* 透明オーバーレイ: メニュー外のクリックを検知して閉じる */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-2 top-9 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-32">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    setEditName(folder.name);
                    setIsRenameModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 text-base hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  名称変更
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    setIsDeleteModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 text-base text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  削除
                </button>
              </div>
            </>
          )}

          {/* ··· メニューボタン（右上に固定） */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((v) => !v);
            }}
            className="absolute top-2 right-2 px-1 text-gray-700 hover:text-gray-900 dark:hover:text-black hover:font-bold text-base leading-none z-10"
            title="メニュー"
          >
            ···
          </button>
        </div>
      </div>

      {/* 削除確認モーダル */}
      {isDeleteModalOpen && (
        <Modal
          title="フォルダーを削除"
          onClose={() => setIsDeleteModalOpen(false)}
        >
          <p className="text-base text-gray-600 dark:text-gray-400">
            「{folder.name}
            」を削除しますか？フォルダー内のノートと子フォルダーも削除されます。
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-base rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
            >
              削除
            </button>
          </div>
        </Modal>
      )}

      {/* 名称変更モーダル */}
      {isRenameModalOpen && (
        <Modal
          title="名称変更"
          onClose={() => {
            setIsRenameModalOpen(false);
            setEditName(folder.name);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
            className="flex flex-col gap-4"
          >
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsRenameModalOpen(false);
                  setEditName(folder.name);
                }}
                className="px-4 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-base rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity"
              >
                変更
              </button>
            </div>
          </form>
        </Modal>
      )}
    </li>
  );
}
