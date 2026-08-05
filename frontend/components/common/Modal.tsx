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
      {/* スクロールバーの色をテーマ（ライト/ダーク）に合わせて指定し、既定の白いバーが浮かないようにする */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto flex flex-col gap-4 [scrollbar-width:thin] [scrollbar-color:#9ca3af_transparent] dark:[scrollbar-color:#4b5563_transparent]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
