import { useState } from "react";
import React from "react";

export function useTagInput(tags: string[], setTags: (tags: string[]) => void) {
  const [tagInput, setTagInput] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  function addTag() {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (trimmed.length > 20) {
      setTagError("タグ名は20文字以内で入力してください");
      return;
    }
    if (tags.length >= 10) {
      setTagError("タグは最大10個までです");
      return;
    }
    if (tags.includes(trimmed)) {
      setTagError("同じタグがすでに追加されています");
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput("");
    setTagError(null);
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // IME 変換中の Enter は無視する（日本語確定の Enter でタグが追加されるのを防ぐ）
    if ((e.key === "Enter" || e.key === ",") && !e.nativeEvent.isComposing) {
      e.preventDefault();
      addTag();
    }
  }

  return { tagInput, setTagInput, tagError, setTagError, addTag, removeTag, handleTagKeyDown };
}
