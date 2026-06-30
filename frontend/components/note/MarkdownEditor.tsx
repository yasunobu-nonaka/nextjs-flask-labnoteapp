"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

/**
 * MDEditor は SSR 時にブラウザ API を参照するため、dynamic import で CSR 専用にする。
 * loading には高さだけ確保したプレースホルダーを表示し、レイアウトシフトを防ぐ。
 */
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="h-[800px]rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />
  ),
});

type Props = {
  /** エディタに表示する Markdown 文字列 */
  value: string;
  /** 内容が変更されるたびに呼ばれるコールバック */
  onChange: (value: string) => void;
};

/**
 * MarkdownEditor コンポーネント
 * @uiw/react-md-editor をラップし、システムのカラースキームに合わせてテーマを切り替える。
 * スプリット表示（左: 入力 / 右: プレビュー）を標準モードとして使用する。
 */
export default function MarkdownEditor({ value, onChange }: Props) {
  // システムのカラースキームを検知してエディタのテーマに反映する
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setColorMode(mq.matches ? "dark" : "light");

    const handler = (e: MediaQueryListEvent) =>
      setColorMode(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    /* data-color-mode は @uiw/react-md-editor が参照するテーマ属性 */
    <div data-color-mode={colorMode}>
      <MDEditor
        value={value}
        onChange={(val) => onChange(val ?? "")}
        height={800}
        preview="live"
      />
    </div>
  );
}
