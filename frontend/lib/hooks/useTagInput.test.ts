import { renderHook, act } from "@testing-library/react";
import { useTagInput } from "./useTagInput";

const tags = ["react", "typescript", "nextjs"];

describe("useTagInput", () => {
  it("タグが追加される", () => {
    const setTags = jest.fn();
    const { result } = renderHook(() => useTagInput(tags, setTags));

    act(() => {
      result.current.setTagInput("python");
    });
    act(() => {
      result.current.addTag();
    });
    expect(setTags).toHaveBeenCalledWith([
      "react",
      "typescript",
      "nextjs",
      "python",
    ]);
    expect(result.current.tagInput).toBe("");
  });

  it("空文字は追加されない（setTagsが呼ばれない）", () => {
    const setTags = jest.fn();
    const { result } = renderHook(() => useTagInput(tags, setTags));

    act(() => {
      result.current.setTagInput("");
    });
    act(() => {
      result.current.addTag();
    });
    expect(setTags).not.toHaveBeenCalled();
  });

  it("21文字のタグではtagErrorにメッセージがセットされる", () => {
    const setTags = jest.fn();
    const { result } = renderHook(() => useTagInput(tags, setTags));

    act(() => {
      result.current.setTagInput("A".repeat(21));
    });
    act(() => {
      result.current.addTag();
    });
    expect(result.current.tagError).toBe(
      "タグ名は20文字以内で入力してください",
    );
  });

  it("既にタグが10個ある状態では追加されない", () => {
    const setTags = jest.fn();
    const tenTags = Array.from({ length: 10 }, (_, i) => `tag${i}`);

    const { result } = renderHook(() => useTagInput(tenTags, setTags));

    act(() => {
      result.current.setTagInput("tag10");
    });
    act(() => {
      result.current.addTag();
    });
    expect(result.current.tagError).toBe("タグは最大10個までです");
    expect(setTags).not.toHaveBeenCalled();
  });

  it("既に同じタグがある場合は追加されない", () => {
    const setTags = jest.fn();
    const { result } = renderHook(() => useTagInput(tags, setTags));

    act(() => {
      result.current.setTagInput("react");
    });
    act(() => {
      result.current.addTag();
    });
    expect(result.current.tagError).toBe("同じタグがすでに追加されています");
  });

  it("removeTagで指定したタグだけが除外される", () => {
    const setTags = jest.fn();
    const { result } = renderHook(() => useTagInput(tags, setTags));

    act(() => {
      result.current.removeTag("react");
    });
    expect(setTags).toHaveBeenCalledWith(["typescript", "nextjs"]);
  });
});
