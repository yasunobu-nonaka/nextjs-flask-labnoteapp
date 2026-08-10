"use client";

import { createContext, useContext } from "react";

type PendingCountContextValue = {
  pendingCount: number;
  /** layout 側の join-requests/count を再取得して pendingCount を更新する */
  refreshPendingCount: () => Promise<void>;
  /** 呼び出し元がこのグループの管理権限（グループadminまたは組織admin系ロール）を持つか */
  isAdmin: boolean;
};

/** グループ管理レイアウトが提供する参加申請件数・再取得関数・管理権限フラグ */
export const PendingCountContext = createContext<PendingCountContextValue>({
  pendingCount: 0,
  refreshPendingCount: async () => {},
  isAdmin: false,
});

/** layout が提供する pendingCount と refreshPendingCount を取得するフック */
export function usePendingCount() {
  return useContext(PendingCountContext);
}
