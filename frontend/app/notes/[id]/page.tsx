"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Markdown from "react-markdown";
import { authFetch } from "@/lib/api";

type Note = {
  id: number;
  title: string;
  content_md: string;
  created_at: string;
  updated_at: string;
  tags: string[];
};

type Status = "loading" | "success" | "error";

export default function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 15 ではルートパラメータが Promise になるため use() で unwrap する
  const { id } = use(params);
  const [note, setNote] = useState<Note | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  // 削除処理中はボタンを無効化するための状態
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  // id が変わるたびにノートを再取得する（別のノートへ遷移したとき）
  useEffect(() => {
    async function fetchNote() {
      try {
        const res = await authFetch(`/api/notes/${id}`);

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (res.status === 404) {
          setError("ノートが見つかりません");
          setStatus("error");
          return;
        }

        if (!res.ok) {
          setError("ノートの取得に失敗しました");
          setStatus("error");
          return;
        }

        const data: Note = await res.json();
        setNote(data);
        setStatus("success");
      } catch {
        setError("サーバーへの接続に失敗しました");
        setStatus("error");
      }
    }

    fetchNote();
  }, [id, router]);

  async function handleDelete() {
    // confirm でユーザーに削除の意図を確認してから API を呼ぶ
    if (!confirm("このノートを削除しますか？")) return;

    setIsDeleting(true);
    try {
      const res = await authFetch(`/api/notes/${id}`, { method: "DELETE" });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        setError("削除に失敗しました");
        return;
      }

      router.push("/notes");
    } catch {
      setError("サーバーへの接続に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (status === "error" || !note) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-4">
        <p className="text-red-500">{error}</p>
        <Link href="/notes" className="text-sm underline text-gray-500">
          一覧へ戻る
        </Link>
      </main>
    );
  }

  // API は ISO 8601 文字列で日時を返すため、日本語表示に変換する
  const createdAt = new Date(note.created_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const updatedAt = new Date(note.updated_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link href="/notes" className="text-sm text-gray-500 underline">
            ← 一覧へ戻る
          </Link>
          <div className="flex gap-2">
            <Link
              href={`/notes/${note.id}/edit`}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              編集
            </Link>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "削除中..." : "削除"}
            </button>
          </div>
        </div>

        {/* タイトル */}
        <h1 className="text-3xl font-bold leading-snug">{note.title}</h1>

        {/* メタ情報 */}
        <div className="flex flex-col gap-2">
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-base rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-400">
            作成日: {createdAt}　更新日: {updatedAt}
          </p>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        {/* コンテンツ */}
        <div className="prose prose-base dark:prose-invert max-w-none">
          <Markdown>{note.content_md}</Markdown>
        </div>
      </div>
    </main>
  );
}
