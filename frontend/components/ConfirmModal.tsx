"use client";

type Props = {
  /** モーダルの表示フラグ */
  isOpen: boolean;
  /** モーダルのタイトル */
  title: string;
  /** 確認メッセージ本文（改行は \n で表現可能） */
  message: string;
  /** 実行ボタンのラベル（省略時: 「実行」） */
  confirmLabel?: string;
  /** キャンセルボタンのラベル（省略時: 「キャンセル」） */
  cancelLabel?: string;
  /**
   * ボタンの色調。
   * "danger"  — 実行ボタンを赤系にする（削除など破壊的操作）
   * "default" — 実行ボタンをデフォルト前景色にする
   */
  variant?: "danger" | "default";
  /** 実行ボタン押下時のコールバック */
  onConfirm: () => void;
  /** キャンセルボタン押下またはバックドロップクリック時のコールバック */
  onCancel: () => void;
};

/**
 * ConfirmModal コンポーネント
 * ブラウザ標準の window.confirm() の代替として使う汎用確認ダイアログ。
 * z-[60] で他のモーダルより前面に表示する。
 */
export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "実行",
  cancelLabel = "キャンセル",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null;

  const confirmButtonClass =
    variant === "danger"
      ? "px-4 py-2 text-base rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
      : "px-4 py-2 text-base rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity";

  return (
    /* バックドロップ: z-[60] で他モーダルより前面に表示する */
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      {/* ダイアログ本体: クリックの伝播を止めてバックドロップの onClick を防ぐ */}
      <div
        className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-xl w-full max-w-sm mx-4 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {/* whitespace-pre-wrap で \n を改行として表示する */}
        <p className="text-base text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={confirmButtonClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
