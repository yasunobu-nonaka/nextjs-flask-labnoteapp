"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** モーダルのタイトル */
  title: string;
  /** タイトル行の右端に表示する操作（作成ボタンなど）。省略可 */
  headerAction?: ReactNode;
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
export default function Modal({
  title,
  headerAction,
  onClose,
  children,
}: Props) {
  return createPortal(
    /* バックドロップ: クリックでモーダルを閉じる。
       document.body 直下に portal で描画し、呼び出し元の祖先要素が isolate 等で
       stacking context を作っていても、それに関係なく画面全体の最前面に表示されるようにする。 */
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
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          {headerAction}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
