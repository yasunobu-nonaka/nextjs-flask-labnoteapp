"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 未保存の変更がある状態でページを離脱しようとした場合に確認するフック。
 *
 * - タブを閉じる・リロード・URL直打ちなどのブラウザ本来の離脱は beforeunload で検知し、
 *   ブラウザ標準の確認ダイアログを表示する
 * - アプリ内リンク・ログアウトなどの Next.js クライアントサイド遷移は beforeunload では検知できないため、
 *   戻り値の confirmBeforeLeave を AppHeader の confirmBeforeLeave prop に渡して使う
 *
 * isDirty の最新値は ref で保持する。beforeunload のリスナーはマウント時に1回だけ登録し、
 * 呼ばれた時点の ref.current を読むことで、登録時点の値に固定されてしまう
 * （古いクロージャを参照してしまう）問題を避ける。
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  /**
   * AppHeader の confirmBeforeLeave prop に渡す関数。
   * 未保存の変更がなければ確認なしで true を返す。変更があれば確認ダイアログの結果を返す。
   */
  const confirmBeforeLeave = useCallback(() => {
    if (!isDirtyRef.current) return true;
    return window.confirm(
      "保存されていない変更があります。このページを離れますか？",
    );
  }, []);

  return confirmBeforeLeave;
}
