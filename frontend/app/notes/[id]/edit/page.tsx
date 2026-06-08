"use client";

import { use, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authFetch } from "@/lib/api";
import { useTagInput } from "@/lib/useTagInput";
import { type Folder, buildFolderOptions } from "@/lib/folders";

const schema = z.object({
  title: z
    .string()
    .min(1, "タイトルは必須です")
    .max(200, "タイトルは200文字以内で入力してください"),
  content_md: z.string().min(1, "内容は必須です"),
  tags: z
    .array(z.string().min(1).max(20, "タグ名は20文字以内で入力してください"))
    .max(10, "タグは最大10個までです"),
});

type FormValues = z.infer<typeof schema>;

type LoadStatus = "loading" | "ready" | "error";

export default function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tags: [] },
  });

  const tags = watch("tags");
  const {
    tagInput,
    setTagInput,
    tagError,
    setTagError,
    addTag,
    removeTag,
    handleTagKeyDown,
  } = useTagInput(tags, (newTags) =>
    setValue("tags", newTags, { shouldValidate: true }),
  );

  useEffect(() => {
    async function fetchFolders() {
      const res = await authFetch("/api/folders");
      if (res.ok) {
        const data: Folder[] = await res.json();
        setFolders(data);
      }
    }
    fetchFolders();
  }, []);

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
        reset({
          title: note.title,
          content_md: note.content_md,
          tags: note.tags,
        });
        setSelectedFolderId(note.folder_id ?? null);
        setLoadStatus("ready");
      } catch {
        setLoadError("サーバーへの接続に失敗しました");
        setLoadStatus("error");
      }
    }

    fetchNote();
  }, [id, router, reset]);

  async function onSubmit(data: FormValues) {
    setGlobalError(null);

    try {
      const res = await authFetch(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...data, folder_id: selectedFolderId }),
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
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">ノートを編集</h1>
          <Link
            href={`/notes/${id}`}
            className="text-sm text-gray-500 underline"
          >
            詳細へ戻る
          </Link>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* タイトル */}
          <div className="flex flex-col gap-1">
            <label htmlFor="title" className="text-sm font-medium">
              タイトル
            </label>
            <input
              id="title"
              {...register("title")}
              type="text"
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground"
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* フォルダー */}
          {folders.length > 0 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="folder" className="text-sm font-medium">
                フォルダー
              </label>
              <select
                id="folder"
                value={selectedFolderId ?? ""}
                onChange={(e) =>
                  setSelectedFolderId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground text-sm"
              >
                <option value="">フォルダーなし</option>
                {buildFolderOptions(folders).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 内容 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="content_md" className="text-sm font-medium">
              内容
            </label>
            <textarea
              id="content_md"
              {...register("content_md")}
              rows={12}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground resize-y font-mono text-sm"
            />
            {errors.content_md && (
              <p className="text-xs text-red-500">
                {errors.content_md.message}
              </p>
            )}
          </div>

          {/* タグ */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">タグ</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setTagError(null);
                }}
                onKeyDown={handleTagKeyDown}
                placeholder="タグを入力して Enter"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground text-sm"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                追加
              </button>
            </div>
            {tagError && <p className="text-xs text-red-500">{tagError}</p>}
            {errors.tags && (
              <p className="text-xs text-red-500">{errors.tags.message}</p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 text-base rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-500 transition-colors"
                      aria-label={`${tag} を削除`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {globalError && <p className="text-sm text-red-500">{globalError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? "保存中..." : "保存する"}
          </button>
        </form>
      </div>
    </main>
  );
}
