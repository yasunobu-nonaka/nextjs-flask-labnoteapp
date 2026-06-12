"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { type NoteFormValues } from "@/lib/noteSchema";
import NoteForm from "@/components/NoteForm";

// "ready" はフォームにノートデータが読み込まれて編集可能な状態を表す
type LoadStatus = "loading" | "ready" | "error";

export default function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 15 ではルートパラメータが Promise になるため use() で unwrap する
  const { id } = use(params);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  // フォーム送信時のサーバーエラーを表示するための状態
  const [globalError, setGlobalError] = useState<string | null>(null);
  // NoteForm に渡す初期値。API 取得後にセットする。
  const [noteData, setNoteData] = useState<NoteFormValues | null>(null);
  const router = useRouter();

  // マウント時（または id が変わったとき）に既存ノートのデータを取得する
  useEffect(() => {
    async function fetchNote() {
      try {
        const res = await authFetch(`/api/notes/${id}`);

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (res.status === 404) {
          setLoadError("ノートが見つかりません");
          setLoadStatus("error");
          return;
        }

        if (!res.ok) {
          setLoadError("ノートの取得に失敗しました");
          setLoadStatus("error");
          return;
        }

        const note = await res.json();
        // noteData を state にセットし、NoteForm がマウントされる際の defaultValues として使う
        setNoteData({ title: note.title, content_md: note.content_md, tags: note.tags });
        setLoadStatus("ready");
      } catch {
        setLoadError("サーバーへの接続に失敗しました");
        setLoadStatus("error");
      }
    }

    fetchNote();
  }, [id, router]);

  async function onSubmit(data: NoteFormValues) {
    setGlobalError(null);
    try {
      // folder_id はノート一覧の移動機能で変更するため、編集フォームには含めない
      const res = await authFetch(`/api/notes/${id}`, {
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

      router.push(`/notes/${id}`);
    } catch {
      setGlobalError("サーバーへの接続に失敗しました");
    }
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
        <Link href="/notes" className="text-sm underline text-gray-500">
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
          <Link href={`/notes/${id}`} className="text-sm text-gray-500 underline">
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
