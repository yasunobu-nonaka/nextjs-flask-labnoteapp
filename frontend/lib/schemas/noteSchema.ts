import { z } from "zod";

// ノート作成・編集フォームで共通で使うバリデーションルール
export const noteSchema = z.object({
  title: z
    .string()
    .min(1, "タイトルは必須です")
    .max(200, "タイトルは200文字以内で入力してください"),
  content_md: z.string().min(1, "内容は必須です"),
  tags: z
    .array(z.string().min(1).max(20, "タグ名は20文字以内で入力してください"))
    .max(10, "タグは最大10個までです"),
  is_private: z.boolean(),
});

// noteSchema から TypeScript の型を自動生成する
export type NoteFormValues = z.infer<typeof noteSchema>;
