"use client";

import { type ReactNode } from "react";

type Props = {
  /** モーダルのタイトル */
  title: string;
  /** バックドロップクリックや「キャンセル」ボタンで呼ばれる閉じるハンドラ */
  onClose: () => void;
  /** タイトル下に表示するコンテンツ */
  children: ReactNode;
};

/**
 * Modal コンポーネント
 * 固定位置のバックドロップとダイアログボックスを提供する汎用モーダル。
 * バックドロップのクリックで onClose が呼ばれ、ダイアログ内クリックはバックドロップに伝播しない。
 */
export default function Modal({ title, onClose, children }: Props) {
  return (
    /* バックドロップ: クリックでモーダルを閉じる */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      {/* ダイアログ本体: クリックの伝播を止めてバックドロップの onClick を防ぐ */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-xl w-80 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
