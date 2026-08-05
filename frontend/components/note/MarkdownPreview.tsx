"use client";

import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 画像プレビュー用のプレースホルダー画像（山と太陽を模したアイコン）。
 * 外部URLへ依存せず常に描画できるよう、SVGをdata URIとして埋め込んでいる。
 * MarkdownCheatsheetModal / MarkdownTutorialModal の「画像」記法例から共有される。
 */
const PLACEHOLDER_IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70" viewBox="0 0 100 70">' +
  '<rect width="100" height="70" rx="6" fill="#d1d5db"/>' +
  '<circle cx="30" cy="28" r="8" fill="#9ca3af"/>' +
  '<path d="M10 55 L38 32 L55 48 L70 30 L90 55 Z" fill="#9ca3af"/>' +
  "</svg>";
export const PLACEHOLDER_IMAGE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_IMAGE_SVG)}`;

/**
 * react-markdown は既定で http(s)/mailto 等以外のプロトコルを空文字に置き換える
 * （XSS対策）。画像プレースホルダーの data: URI もそのままでは弾かれてしまうため、
 * 安全な data:image/ のみ例外的に許可し、それ以外は既定のサニタイズ処理に委ねる。
 */
function allowDataImageUrl(url: string) {
  if (url.startsWith("data:image/")) return url;
  return defaultUrlTransform(url);
}

type Props = {
  /** レンダリングする Markdown ソース */
  markdown: string;
};

/**
 * MarkdownPreview コンポーネント
 * react-markdown + remark-gfm を使い、Markdownソースを実際の見た目通りにレンダリングする
 * 共通部品。ノート詳細画面の本文表示と同じ仕組みを使うことで、記法一覧・チュートリアルの
 * プレビューが実際のノート編集画面と乖離しないようにする。
 */
export default function MarkdownPreview({ markdown }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto">
      <Markdown remarkPlugins={[remarkGfm]} urlTransform={allowDataImageUrl}>
        {markdown}
      </Markdown>
    </div>
  );
}
