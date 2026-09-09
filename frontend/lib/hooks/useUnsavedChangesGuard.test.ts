import { renderHook } from "@testing-library/react";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

describe("useUnsavedChangesGuard", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("confirmBeforeLeave", () => {
    it("isDirty が false なら確認ダイアログを出さず true を返す", () => {
      const confirmSpy = jest.spyOn(window, "confirm");
      const { result } = renderHook(() => useUnsavedChangesGuard(false));

      expect(result.current()).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it("isDirty が true なら window.confirm の結果をそのまま返す", () => {
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
      const { result } = renderHook(() => useUnsavedChangesGuard(true));

      expect(result.current()).toBe(false);
      expect(confirmSpy).toHaveBeenCalledWith(
        "保存されていない変更があります。このページを離れますか？",
      );
    });
  });

  describe("beforeunload", () => {
    it("isDirty が true なら beforeunload をキャンセルする", () => {
      renderHook(() => useUnsavedChangesGuard(true));

      const event = new Event("beforeunload", { cancelable: true });
      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("isDirty が false なら beforeunload をキャンセルしない", () => {
      renderHook(() => useUnsavedChangesGuard(false));

      const event = new Event("beforeunload", { cancelable: true });
      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      window.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("beforeunload リスナーは1回しか登録されないが、再レンダー後の最新の isDirty を参照する", () => {
      // このフックはコメントにある通り、beforeunload のリスナーをマウント時に1回だけ登録し、
      // ref 経由で最新の isDirty を読む設計になっている。もし ref を使わず isDirty を直接
      // クロージャで参照していたら、rerender 後も登録時点（false）のままになってしまうはず。
      const { rerender } = renderHook(
        ({ isDirty }) => useUnsavedChangesGuard(isDirty),
        { initialProps: { isDirty: false } },
      );

      rerender({ isDirty: true });

      const event = new Event("beforeunload", { cancelable: true });
      const preventDefaultSpy = jest.spyOn(event, "preventDefault");
      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});
