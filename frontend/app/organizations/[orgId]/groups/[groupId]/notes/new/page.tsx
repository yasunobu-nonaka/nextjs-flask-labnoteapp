"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import { type NoteFormValues } from "@/lib/schemas/noteSchema";
import NoteForm from "@/components/note/NoteForm";
import AppHeader from "@/components/layout/AppHeader";

/**
 * ノート新規作成ページ（グループスコープ版）
 * URL パラメータ folder_id が指定されていればそのフォルダーにノートを作成する。
 */
export default function NewNotePage() {
  const { orgId, groupId } = useParams<{ orgId: string; groupId: string }>();
  const orgIdNum = Number(orgId);
  const groupIdNum = Number(groupId);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<number | null>(null);
  const router = useRouter();

  // URLクエリパラメータ folder_id を読み取り、指定フォルダーにノートを作成するかどうかを決める
  // window は SSR で参照できないため useEffect 内で読む（意図的な同期 setState）
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("folder_id");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setFolderId(Number(id));
  }, []);

  async function onSubmit(data: NoteFormValues) {
    setGlobalError(null);
    try {
      const res = await authFetch(
        `/api/organizations/${orgIdNum}/groups/${groupIdNum}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ ...data, folder_id: folderId }),
        },
      );

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const json = await res.json();
        setGlobalError(json.message ?? "エラーが発生しました");
        return;
      }

      router.push(`/organizations/${orgId}/groups/${groupId}/notes`);
    } catch {
      setGlobalError("サーバーへの接続に失敗しました");
    }
  }

  const notesListHref = `/organizations/${orgId}/groups/${groupId}/notes`;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader backHref={notesListHref} backLabel="ノート一覧へ" />
      <main className="flex-1 px-6 py-10">
      <div className="max-w-full mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">ノートを作成</h1>
        </div>

        <NoteForm
          defaultValues={{ title: "", content_md: "", tags: [], is_private: false }}
          onSubmit={onSubmit}
          submitLabel="作成する"
          submittingLabel="作成中..."
          globalError={globalError}
        />
      </div>
      </main>
    </div>
  );
}
