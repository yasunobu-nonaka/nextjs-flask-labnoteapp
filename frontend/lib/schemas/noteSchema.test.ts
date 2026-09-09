import { noteSchema } from "./noteSchema";

const validNote = {
  title: "実験ノート",
  content_md: "今日の実験結果...",
  tags: ["React", "TypeScript"],
  is_private: false,
};

describe("noteSchema", () => {
  it("正しい入力は検証を通過する", () => {
    const result = noteSchema.safeParse(validNote);
    expect(result.success).toBe(true);
  });

  it("タイトルが空文字だとエラーになる", () => {
    const result = noteSchema.safeParse({ ...validNote, title: "" });
    expect(result.success).toBe(false);
  });

  it("タイトルが200文字を超えるとエラーになる", () => {
    const result = noteSchema.safeParse({
      ...validNote,
      title: "あ".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("タイトルがちょうど200文字なら通過する", () => {
    const result = noteSchema.safeParse({
      ...validNote,
      title: "あ".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it("本文が空文字だとエラーになる", () => {
    const result = noteSchema.safeParse({ ...validNote, content_md: "" });
    expect(result.success).toBe(false);
  });

  it("タグが20文字を超えるとエラーになる", () => {
    const result = noteSchema.safeParse({
      ...validNote,
      tags: ["あ".repeat(21)],
    });
    expect(result.success).toBe(false);
  });

  it("タグが11個以上あるとエラーになる", () => {
    const result = noteSchema.safeParse({
      ...validNote,
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("タグが空配列でも通過する", () => {
    const result = noteSchema.safeParse({ ...validNote, tags: [] });
    expect(result.success).toBe(true);
  });

  it("is_private が boolean でないとエラーになる", () => {
    const result = noteSchema.safeParse({
      ...validNote,
      is_private: "false",
    });
    expect(result.success).toBe(false);
  });
});
