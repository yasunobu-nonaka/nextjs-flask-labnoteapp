"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authFetch } from "@/lib/api";
import { useTagInput } from "@/lib/useTagInput";

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

export default function NewNotePage() {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tags: [] },
  });

  const tags = watch("tags");
  const { tagInput, setTagInput, tagError, setTagError, addTag, removeTag, handleTagKeyDown } =
    useTagInput(tags, (newTags) => setValue("tags", newTags, { shouldValidate: true }));

  async function onSubmit(data: FormValues) {
    setGlobalError(null);

    try {
      const res = await authFetch("/api/notes", {
        method: "POST",
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

      router.push("/notes");
    } catch {
      setGlobalError("サーバーへの接続に失敗しました");
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">ノートを作成</h1>
          <Link href="/notes" className="text-sm text-gray-500 underline">
            一覧へ戻る
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
            {isSubmitting ? "作成中..." : "作成する"}
          </button>
        </form>
      </div>
    </main>
  );
}
