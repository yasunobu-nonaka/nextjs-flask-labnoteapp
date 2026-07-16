"use client";

import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
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
  /** 「書き方」列にそのまま表示する Markdown ソース（複数行は \n 区切り） */
  markdown: string;
  /** 「表示」列のプレビュー生成に使うソース。省略時は markdown をそのまま使う。
   *  画像のように markdown 列は説明用のプレースホルダーにしたいが、
   *  プレビューは実際に描画できる値にしたい場合に指定する。 */
  renderMarkdown?: string;
};

/**
 * 画像プレビュー用のプレースホルダー画像（山と太陽を模したアイコン）。
 * 外部URLへ依存せず常に描画できるよう、SVGをdata URIとして埋め込んでいる。
 */
const PLACEHOLDER_IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70" viewBox="0 0 100 70">' +
  '<rect width="100" height="70" rx="6" fill="#d1d5db"/>' +
  '<circle cx="30" cy="28" r="8" fill="#9ca3af"/>' +
  '<path d="M10 55 L38 32 L55 48 L70 30 L90 55 Z" fill="#9ca3af"/>' +
  "</svg>";
const PLACEHOLDER_IMAGE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_IMAGE_SVG)}`;

/**
 * react-markdown は既定で http(s)/mailto 等以外のプロトコルを空文字に置き換える
 * （XSS対策）。画像プレースホルダーの data: URI もそのままでは弾かれてしまうため、
 * 安全な data:image/ のみ例外的に許可し、それ以外は既定のサニタイズ処理に委ねる。
 */
function allowDataImageUrl(url: string) {
  if (url.startsWith("data:image/")) return url;
  return defaultUrlTransform(url);
}

/**
 * MarkdownEditor のプレビュー（remark-gfm 対応）が実際に描画できる記法のみを掲載する。
 * 表・取り消し線・チェックボックスも remark-gfm によりサポートされているため含めている。
 */
const CHEATSHEET_ROWS: CheatsheetRow[] = [
  { label: "見出し", markdown: "# 見出し1\n## 見出し2\n### 見出し3" },
  { label: "太字", markdown: "**太字**" },
  { label: "斜体", markdown: "*斜体*" },
  { label: "取り消し線", markdown: "~~取り消し線~~" },
  { label: "箇条書き", markdown: "- 項目1\n- 項目2" },
  { label: "番号付きリスト", markdown: "1. 項目1\n2. 項目2" },
  { label: "チェックボックス", markdown: "- [ ] 未完了\n- [x] 完了" },
  { label: "リンク", markdown: "[表示名](https://example.com)" },
  {
    label: "画像",
    markdown: "![代替テキスト](画像URL)",
    renderMarkdown: `![代替テキスト](${PLACEHOLDER_IMAGE_DATA_URI})`,
  },
  { label: "インラインコード", markdown: "`code`" },
  { label: "コードブロック", markdown: "```python\ncode\n```" },
  { label: "引用", markdown: "> 引用文" },
  { label: "テーブル", markdown: "| A | B |\n|---|---|\n| 1 | 2 |" },
  { label: "水平線", markdown: "---" },
];

/**
 * MarkdownCheatsheetModal コンポーネント
 * Markdown記法に不慣れなユーザー向けに、ノート編集画面から参照できる
 * クイックリファレンス（記法一覧表）を表示する。「書き方」と「表示」を並べて見せることで、
 * 記法を見ただけで実際の見た目もイメージできるようにする。フォームや送信処理を持たない
 * 表示専用のモーダルで、既存の isOpen/onClose ラッパー方式で Modal をラップする。
 */
export default function MarkdownCheatsheetModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <Modal title="Markdown クイックリファレンス" onClose={onClose}>
      <table className="w-full border border-gray-300 dark:border-gray-700 text-sm">
        <thead>
          <tr className="border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <th className="px-3 py-2 text-left font-medium w-1/6">記法</th>
            <th className="px-3 py-2 text-left font-medium w-2/5">書き方</th>
            <th className="px-3 py-2 text-left font-medium">表示</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-300 dark:divide-gray-700">
          {CHEATSHEET_ROWS.map((row) => (
            <tr key={row.label}>
              <td className="px-3 py-2 align-top">{row.label}</td>
              <td className="px-3 py-2 align-top">
                <code className="block px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 whitespace-pre-wrap break-words">
                  {row.markdown}
                </code>
              </td>
              <td className="px-3 py-2 align-top">
                {/* prose: @tailwindcss/typography による Markdown 描画のデフォルトスタイル。
                    ノート詳細画面の本文表示と同じ仕組みで、実際の見た目に近いプレビューになる */}
                <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    urlTransform={allowDataImageUrl}
                  >
                    {row.renderMarkdown ?? row.markdown}
                  </Markdown>
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
