"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Markdown from "react-markdown";
import { authFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Note = {
  id: number;
  title: string;
  content_md: string;
  created_at: string;
  updated_at: string;
  tags: string[];
};

type Status = "loading" | "success" | "error";

/**
 * ノート詳細ページ（グループスコープ版）
 * Markdown コンテンツをレンダリングして表示する。
 * ヘッダーに編集・削除ボタンを配置する。
 */
export default function NoteDetailPage() {
  const { orgId, groupId, noteId } = useParams<{ orgId: string; groupId: string; noteId: string }>();
  const orgIdNum = Number(orgId);
  const groupIdNum = Number(groupId);

  const [note, setNote] = useState<Note | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  const router = useRouter();

  const notesListHref = `/organizations/${orgId}/groups/${groupId}/notes`;
  const noteApiPath = `/api/organizations/${orgIdNum}/groups/${groupIdNum}/notes/${noteId}`;

  // id が変わるたびにノートを再取得する
  useEffect(() => {
    async function fetchNote() {
      try {
        const res = await authFetch(noteApiPath);

        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 404) {
          setIsNotFound(true);
          return;
        }
        if (res.status === 403) {
          setError("このグループのメンバーではありません。グループ一覧からメンバー参加を申請してください。");
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
  }, [noteApiPath, router]);

  async function handleDelete() {
    if (!confirm("このノートを削除しますか？")) return;

    setIsDeleting(true);
    try {
      const res = await authFetch(noteApiPath, { method: "DELETE" });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setError("削除に失敗しました");
        return;
      }

      router.push(notesListHref);
    } catch {
      setError("サーバーへの接続に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isNotFound) {
    notFound();
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
        <Link href={notesListHref} className="text-sm underline text-gray-500">
          一覧へ戻る
        </Link>
      </main>
    );
  }

  const createdAt = formatDate(note.created_at);
  const updatedAt = formatDate(note.updated_at);

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <Link href={notesListHref} className="text-sm text-gray-500 underline">
            ← 一覧へ戻る
          </Link>
          <div className="flex gap-2">
            <Link
              href={`/organizations/${orgId}/groups/${groupId}/notes/${noteId}/edit`}
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

        {/* Markdown コンテンツ */}
        <div className="prose prose-base dark:prose-invert max-w-none">
          <Markdown>{note.content_md}</Markdown>
        </div>
      </div>
    </main>
  );
}
