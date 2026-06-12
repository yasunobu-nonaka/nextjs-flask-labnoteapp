"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { type NoteFormValues } from "@/lib/noteSchema";
import NoteForm from "@/components/NoteForm";

export default function NewNotePage() {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<number | null>(null);
  const router = useRouter();

  // URLクエリパラメータ folder_id を読み取り、指定フォルダーにノートを作成するかどうかを決める
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("folder_id");
    if (id) setFolderId(Number(id));
  }, []);

  async function onSubmit(data: NoteFormValues) {
    setGlobalError(null);
    try {
      // folderId は URL パラメータ由来。フォームの値と合わせて送信する。
      const res = await authFetch("/api/notes", {
        method: "POST",
        body: JSON.stringify({ ...data, folder_id: folderId }),
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

      router.push("/notes");
    } catch {
      setGlobalError("サーバーへの接続に失敗しました");
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="max-w-full mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">ノートを作成</h1>
          <Link href="/notes" className="text-sm text-gray-500 underline">
            一覧へ戻る
          </Link>
        </div>

        <NoteForm
          defaultValues={{ title: "", content_md: "", tags: [] }}
          onSubmit={onSubmit}
          submitLabel="作成する"
          submittingLabel="作成中..."
          globalError={globalError}
        />
      </div>
    </main>
  );
}
