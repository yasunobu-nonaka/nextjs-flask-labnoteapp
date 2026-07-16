"use client";

import Modal from "@/components/common/Modal";
import MarkdownPreview, {
  PLACEHOLDER_IMAGE_DATA_URI,
} from "@/components/note/MarkdownPreview";

type Props = {
  /** モーダルの表示状態。false のときは何もレンダリングしない */
  isOpen: boolean;
  /** バックドロップクリックや「閉じる」ボタンで呼ばれる閉じるハンドラ */
  onClose: () => void;
};

/** チュートリアルの1セクション分のデータ型 */
type TutorialSection = {
  /** セクションの見出し（例: 見出し、太字） */
  title: string;
  /** 記法の使いどころや意味を説明する文章 */
  description: string;
  /** 「書き方」に表示する Markdown ソース（複数行は \n 区切り） */
  markdown: string;
  /** プレビュー生成に使うソース。省略時は markdown をそのまま使う */
  renderMarkdown?: string;
};

/**
 * MarkdownCheatsheetModal（早見表）より踏み込んで、各記法の使いどころを
 * 文章で説明するチュートリアル用データ。remark-gfm が対応する記法のみ掲載する。
 */
const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    title: "見出し",
    description:
      "行頭に # を1〜3個つけると見出しになります。# の数が多いほど小さい見出しになり、実験ノートの章立てや手順の区切りに使うと読みやすくなります。",
    markdown: "# 見出し1\n## 見出し2\n### 見出し3",
  },
  {
    title: "太字・斜体",
    description:
      "文字をアスタリスク（*）で囲むと強調表示になります。** で囲むと太字、* 1つで囲むと斜体になり、注意点や重要な数値を目立たせたいときに使います。",
    markdown: "**太字**\n*斜体*",
  },
  {
    title: "取り消し線",
    description:
      "~~ で囲むと取り消し線になります。誤りだったが記録として残しておきたい内容や、後で取り消した仮説などに使えます。",
    markdown: "~~取り消し線~~",
  },
  {
    title: "箇条書き・番号付きリスト",
    description:
      "行頭に - を付けると箇条書き、1. のように数字とピリオドを付けると番号付きリストになります。手順や材料の列挙に向いています。",
    markdown: "- 項目1\n- 項目2\n\n1. 手順1\n2. 手順2",
  },
  {
    title: "チェックボックス",
    description:
      "- [ ] で未完了、- [x] で完了のチェックボックスになります。実験の進捗管理やTODOリストとして使えます。",
    markdown: "- [ ] 未完了のタスク\n- [x] 完了したタスク",
  },
  {
    title: "リンク",
    description:
      "[表示名](URL) の形式で、参考文献やデータの出典元へのリンクを貼れます。",
    markdown: "[表示名](https://example.com)",
  },
  {
    title: "画像",
    description:
      "![代替テキスト](画像URL) の形式で画像を貼り付けられます。実験結果のグラフや装置の写真などを埋め込むのに使います。",
    markdown: "![代替テキスト](画像URL)",
    renderMarkdown: `![代替テキスト](${PLACEHOLDER_IMAGE_DATA_URI})`,
  },
  {
    title: "インラインコード・コードブロック",
    description:
      "`（バッククォート）1つで囲むと文中コード、``` で前後を囲むとコードブロックになります。解析スクリプトやコマンドをそのままの形式で残せます。",
    markdown: "文中に `code` を挟む\n\n```python\nprint(\"hello\")\n```",
  },
  {
    title: "引用",
    description:
      "行頭に > を付けると引用文になります。他の資料からの引用や、実験対象者のコメントを区別して記録したいときに使います。",
    markdown: "> 引用文",
  },
  {
    title: "テーブル",
    description:
      "| で区切って列を作り、2行目に |---|---| のような区切り線を入れるとテーブルになります。測定結果の一覧などに向いています。",
    markdown: "| 項目 | 値 |\n|---|---|\n| 温度 | 25℃ |",
  },
  {
    title: "水平線",
    description: "--- のみの行を入れると、内容を区切る水平線になります。",
    markdown: "---",
  },
];

/**
 * MarkdownTutorialModal コンポーネント
 * MarkdownCheatsheetModal（早見表）よりも詳しく、各記法の意味や使いどころを文章付きで
 * 説明するチュートリアル。ノート新規作成フォームの初回表示時に「見ますか？」と確認した上で
 * 開かれる想定。フォームや送信処理を持たない表示専用のモーダルで、既存の isOpen/onClose
 * ラッパー方式で Modal をラップする。
 */
export default function MarkdownTutorialModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <Modal title="Markdown 記法チュートリアル" onClose={onClose}>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Markdownは、記号を使って見出しや強調・リストなどを表現できる軽量な記法です。
        以下の代表的な記法を、書き方と実際の表示を見比べながら覚えていきましょう。
      </p>

      <div className="flex flex-col gap-6">
        {TUTORIAL_SECTIONS.map((section) => (
          <section
            key={section.title}
            className="flex flex-col gap-2 pb-6 border-b border-gray-200 dark:border-gray-800 last:border-b-0 last:pb-0"
          >
            <h3 className="text-base font-semibold">{section.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {section.description}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  書き方
                </span>
                <code className="block px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-sm whitespace-pre-wrap break-words">
                  {section.markdown}
                </code>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  表示
                </span>
                <MarkdownPreview
                  markdown={section.renderMarkdown ?? section.markdown}
                />
              </div>
            </div>
          </section>
        ))}
      </div>

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
