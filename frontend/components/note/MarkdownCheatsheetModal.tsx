"use client";

import Modal from "@/components/common/Modal";

type Props = {
  /** モーダルの表示状態。false のときは何もレンダリングしない */
  isOpen: boolean;
  /** バックドロップクリックや「閉じる」ボタンで呼ばれる閉じるハンドラ */
  onClose: () => void;
};

/** 記法一覧の1行分のデータ型 */
type CheatsheetRow = {
  /** 記法の名称（例: 見出し、太字） */
  label: string;
  /** 実際の Markdown 記述例。複数パターンがある場合は配列で複数行表示する */
  examples: string[];
};

/**
 * MarkdownEditor のプレビュー（remark-gfm 対応）が実際に描画できる記法のみを掲載する。
 * 表・取り消し線・チェックボックスも remark-gfm によりサポートされているため含めている。
 */
const CHEATSHEET_ROWS: CheatsheetRow[] = [
  { label: "見出し", examples: ["# 見出し1", "## 見出し2", "### 見出し3"] },
  { label: "太字", examples: ["**太字**"] },
  { label: "斜体", examples: ["*斜体*"] },
  { label: "取り消し線", examples: ["~~取り消し線~~"] },
  { label: "箇条書き", examples: ["- 項目1", "- 項目2"] },
  { label: "番号付きリスト", examples: ["1. 項目1", "2. 項目2"] },
  { label: "チェックボックス", examples: ["- [ ] 未完了", "- [x] 完了"] },
  { label: "リンク", examples: ["[表示名](https://example.com)"] },
  { label: "画像", examples: ["![代替テキスト](画像URL)"] },
  { label: "インラインコード", examples: ["`code`"] },
  {
    label: "コードブロック",
    examples: ["```python", "code", "```"],
  },
  { label: "引用", examples: ["> 引用文"] },
  {
    label: "テーブル",
    examples: ["| A | B |", "|---|---|", "| 1 | 2 |"],
  },
  { label: "水平線", examples: ["---"] },
];

/**
 * MarkdownCheatsheetModal コンポーネント
 * Markdown記法に不慣れなユーザー向けに、ノート編集画面から参照できる
 * クイックリファレンス（記法一覧表）を表示する。フォームや送信処理を持たない
 * 表示専用のモーダルで、既存の isOpen/onClose ラッパー方式で Modal をラップする。
 */
export default function MarkdownCheatsheetModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <Modal title="Markdown クイックリファレンス" onClose={onClose}>
      <table className="w-full border border-gray-300 dark:border-gray-700 text-sm">
        <thead>
          <tr className="border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <th className="px-3 py-2 text-left font-medium w-1/3">記法</th>
            <th className="px-3 py-2 text-left font-medium">例</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-300 dark:divide-gray-700">
          {CHEATSHEET_ROWS.map((row) => (
            <tr key={row.label}>
              <td className="px-3 py-2 align-top">{row.label}</td>
              <td className="px-3 py-2">
                <div className="flex flex-col gap-1">
                  {row.examples.map((example, i) => (
                    <code
                      key={i}
                      className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 whitespace-pre-wrap break-words w-fit"
                    >
                      {example}
                    </code>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={onClose}
        className="self-end px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        閉じる
      </button>
    </Modal>
  );
}
