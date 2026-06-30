"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { noteSchema, type NoteFormValues } from "@/lib/schemas/noteSchema";
import { useTagInput } from "@/lib/hooks/useTagInput";
import MarkdownEditor from "@/components/note/MarkdownEditor";

type Props = {
  // マウント時のフォーム初期値。編集ページでは取得したノートのデータを渡す。
  defaultValues: NoteFormValues;
  // バリデーション通過後に親ページが API 呼び出しを行うコールバック
  onSubmit: (data: NoteFormValues) => Promise<void>;
  submitLabel: string;
  submittingLabel: string;
  // API 呼び出し後のサーバーエラーを親ページから受け取って表示する
  globalError: string | null;
};

export default function NoteForm({
  defaultValues,
  onSubmit,
  submitLabel,
  submittingLabel,
  globalError,
}: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues,
  });

  // content_md は MDEditor の onChange で直接 setValue するため watch で現在値を取得する
  // React Hook Form の watch() は React Compiler と相性が悪いが、このコンポーネントでは問題ない
  // eslint-disable-next-line react-hooks/incompatible-library
  const contentMd = watch("content_md");

  // tags フィールドを監視し、useTagInput に現在値を渡す
  const tags = watch("tags");
  // タグが追加・削除されると setValue で react-hook-form の値を更新する
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

  return (
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

      {/* 内容: MarkdownEditor でスプリットプレビュー付き入力 */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">内容</label>
        <MarkdownEditor
          value={contentMd}
          onChange={(val) =>
            setValue("content_md", val, { shouldValidate: true })
          }
        />
        {errors.content_md && (
          <p className="text-xs text-red-500">{errors.content_md.message}</p>
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

      {/* 非公開設定: チェックをいれると作成者と共有メンバーのみが閲覧できるプライベートノートになる */}
      <div className="flex items-center gap-3">
        <input
          id="is_private"
          type="checkbox"
          {...register("is_private")}
          className="w-4 h-4 accent-foreground"
        />
        <label htmlFor="is_private" className="text-sm font-medium select-none">
          非公開ノートにする
          <span className="ml-2 text-xs text-gray-400 font-normal">
            （自分と共有したメンバーのみ閲覧できます）
          </span>
        </label>
      </div>

      {globalError && <p className="text-sm text-red-500">{globalError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
