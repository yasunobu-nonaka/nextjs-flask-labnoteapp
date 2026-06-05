"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

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
  const { id } = use(params);
  const [note, setNote] = useState<Note | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchNote() {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/notes/${id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

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
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link href="/notes" className="text-sm text-gray-500 underline">
            ← 一覧へ戻る
          </Link>
        </div>

        {/* タイトル */}
        <h1 className="text-3xl font-bold leading-snug">{note.title}</h1>

        {/* メタ情報 */}
        <div className="flex flex-col gap-2">
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400">
            作成日: {createdAt}　更新日: {updatedAt}
          </p>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        {/* コンテンツ */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{note.content_md}</ReactMarkdown>
        </div>
      </div>
    </main>
  );
}
