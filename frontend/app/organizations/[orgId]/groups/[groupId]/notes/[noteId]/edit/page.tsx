"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { type NoteFormValues } from "@/lib/schemas/noteSchema";
import NoteForm from "@/components/NoteForm";

type LoadStatus = "loading" | "ready" | "error";

/**
 * ノート編集ページ（グループスコープ版）
 * 既存ノートのデータを取得してフォームに初期値としてセットし、保存する。
 */
export default function EditNotePage() {
  const { orgId, groupId, noteId } = useParams<{ orgId: string; groupId: string; noteId: string }>();
  const orgIdNum = Number(orgId);
  const groupIdNum = Number(groupId);

  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  // NoteForm に渡す初期値。API 取得後にセットする。
  const [noteData, setNoteData] = useState<NoteFormValues | null>(null);
  const router = useRouter();

  const notesListHref = `/organizations/${orgId}/groups/${groupId}/notes`;
  const noteDetailHref = `/organizations/${orgId}/groups/${groupId}/notes/${noteId}`;
  const noteApiPath = `/api/organizations/${orgIdNum}/groups/${groupIdNum}/notes/${noteId}`;

  // マウント時に既存ノートのデータを取得する
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
          setLoadError("このグループのメンバーではありません。グループ一覧からメンバー参加を申請してください。");
          setLoadStatus("error");
          return;
        }
        if (!res.ok) {
          setLoadError("ノートの取得に失敗しました");
          setLoadStatus("error");
          return;
        }

        const note = await res.json();
        setNoteData({ title: note.title, content_md: note.content_md, tags: note.tags });
        setLoadStatus("ready");
      } catch {
        setLoadError("サーバーへの接続に失敗しました");
        setLoadStatus("error");
      }
    }
    fetchNote();
  }, [noteApiPath, router]);

  async function onSubmit(data: NoteFormValues) {
    setGlobalError(null);
    try {
      // folder_id はノート一覧の移動機能で変更するため、編集フォームには含めない
      const res = await authFetch(noteApiPath, {
        method: "PATCH",
        body: JSON.stringify(data),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const json = await res.json();
        setGlobalError(json.message ?? "エラーが発生しました");
        return;
      }

      router.push(noteDetailHref);
    } catch {
      setGlobalError("サーバーへの接続に失敗しました");
    }
  }

  if (isNotFound) {
    notFound();
  }

  if (loadStatus === "loading") {
    return (
      <main className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (loadStatus === "error") {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-4">
        <p className="text-red-500">{loadError}</p>
        <Link href={notesListHref} className="text-sm underline text-gray-500">
          一覧へ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="max-w-full mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">ノートを編集</h1>
          <Link href={noteDetailHref} className="text-sm text-gray-500 underline">
            詳細へ戻る
          </Link>
        </div>

        {/* loadStatus === "ready" のときだけレンダリングするため、
            noteData は必ず非 null。NoteForm は正しい defaultValues でマウントされる。 */}
        <NoteForm
          defaultValues={noteData!}
          onSubmit={onSubmit}
          submitLabel="保存する"
          submittingLabel="保存中..."
          globalError={globalError}
        />
      </div>
    </main>
  );
}
