"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Markdown from "react-markdown";
import { authFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import AppHeader from "@/components/AppHeader";
import NoteShareModal from "@/components/NoteShareModal";
import { type PrivateMember } from "@/components/NoteCard";

type Note = {
  id: number;
  title: string;
  content_md: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  is_private: boolean;
  is_owner: boolean;
  private_members: PrivateMember[];
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
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
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <AppHeader backHref={notesListHref} backLabel="ノート一覧へ" />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">読み込み中...</p>
        </main>
      </div>
    );
  }

  if (status === "error" || !note) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <AppHeader backHref={notesListHref} backLabel="ノート一覧へ" />
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-red-500">{error}</p>
        </main>
      </div>
    );
  }

  const createdAt = formatDate(note.created_at);
  const updatedAt = formatDate(note.updated_at);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader backHref={notesListHref} backLabel="ノート一覧へ" />
      <main className="flex-1 px-6 py-10">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {/* 操作ボタン */}
        <div className="flex justify-end gap-2">
          {/* 非公開ノートのオーナーのみ共有設定ボタンを表示する */}
          {note.is_private && note.is_owner && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              共有設定
            </button>
          )}
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

        {/* タイトル */}
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold leading-snug">{note.title}</h1>
          {/* 非公開バッジ: is_private のときのみ表示 */}
          {note.is_private && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              非公開
            </span>
          )}
        </div>

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

      {/* 共有設定モーダル: オーナーが共有メンバーを管理する */}
      <NoteShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        noteId={note.id}
        orgId={orgIdNum}
        groupId={groupIdNum}
        notesBase={`/organizations/${orgId}/groups/${groupId}/notes`}
        privateMembers={note.private_members}
        onUpdated={(members) => setNote((prev) => prev ? { ...prev, private_members: members } : prev)}
      />
    </div>
  );
}
