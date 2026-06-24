"use client";

import { createContext, useContext } from "react";

type PendingCountContextValue = {
  pendingCount: number;
  /** layout 側の join-requests/count を再取得して pendingCount を更新する */
  refreshPendingCount: () => Promise<void>;
};

/** グループ管理レイアウトが提供する参加申請件数とその再取得関数 */
export const PendingCountContext = createContext<PendingCountContextValue>({
  pendingCount: 0,
  refreshPendingCount: async () => {},
});

/** layout が提供する pendingCount と refreshPendingCount を取得するフック */
export function usePendingCount() {
  return useContext(PendingCountContext);
}
