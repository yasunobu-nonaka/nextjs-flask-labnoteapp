"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  function handleClear() {
    setQuery("");
    setSubmittedQuery("");
  }

  useEffect(() => {
    async function fetchNotes() {
      setStatus("loading");
      try {
        const params = submittedQuery ? `?q=${encodeURIComponent(submittedQuery)}` : "";
        const res = await authFetch(`/api/notes${params}`);

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (!res.ok) {
          setError("ノートの取得に失敗しました");
          setStatus("error");
          return;
        }

        const data: Note[] = await res.json();
        setNotes(data);
        setStatus("success");
      } catch {
        setError("サーバーへの接続に失敗しました");
        setStatus("error");
      }
    }

    fetchNotes();
  }, [router, submittedQuery]);

  if (status === "loading") {
    return (
      <main className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">ノート一覧</h1>
          <div className="flex gap-2">
            <Link
              href="/notes/new"
              className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              新規作成
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setSubmittedQuery(query.trim()); }} className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトルで検索..."
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            検索
          </button>
        </form>

        {submittedQuery && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>「{submittedQuery}」の検索結果 {notes.length}件</p>
            <button onClick={handleClear} className="underline hover:text-foreground transition-colors">
              クリア
            </button>
          </div>
        )}

        {notes.length === 0 ? (
          <p className="text-gray-500">
            {submittedQuery ? "該当するノートが見つかりませんでした。" : "ノートがありません。"}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function NoteCard({ note }: { note: Note }) {
  const date = new Date(note.updated_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <li className="flex flex-col gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/notes/${note.id}`} className="font-semibold text-lg leading-snug hover:underline">
          {note.title}
        </Link>
        <span className="text-xs text-gray-400 shrink-0 mt-1">{date}</span>
      </div>

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
    </li>
  );
}
