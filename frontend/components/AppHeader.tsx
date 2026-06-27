"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

/** 管理者向け: グループへの参加申請 */
type JoinRequestNotification = {
  type: "join_request";
  org_id: number;
  group_id: number;
  group_name: string;
  requester_user_id: number;
  requester_username: string;
  requester_email: string;
  requested_at: string | null;
};

/** 申請者向け: 自分の申請が承認された */
type JoinApprovedNotification = {
  type: "join_request_approved";
  org_id: number;
  group_id: number;
  group_name: string;
  approved_at: string | null;
};

/** 申請者向け: 自分の申請が拒否された */
type JoinRejectedNotification = {
  type: "join_request_rejected";
  org_id: number;
  group_id: number;
  group_name: string;
  rejected_at: string | null;
};

/** プライベートノートへの招待 */
type PrivateNoteInvitationNotification = {
  type: "private_note_invitation";
  id: number;
  message: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string | null;
};

type Notification =
  | JoinRequestNotification
  | JoinApprovedNotification
  | JoinRejectedNotification
  | PrivateNoteInvitationNotification;

const POLL_INTERVAL_MS = 30_000;
/** localStorage に保存する最終既読タイムスタンプのキー */
const LAST_SEEN_KEY = "notifications_last_seen";

/**
 * 全ページ共通のアプリヘッダー。
 * 右端にベルアイコン（未読バッジ付き）とユーザーアバターメニューを表示する。
 *
 * - マウント時に /api/auth/me でユーザー名を取得する
 * - /api/notifications を 30 秒ごとにポーリングして参加申請通知を収集する
 * - localStorage の notifications_last_seen と比較し、未既読を判定する
 * - ベルアイコンをクリックするとポップオーバーで通知一覧を表示し、last_seen を更新する
 * - 各通知をクリックすると該当グループのメンバー管理ページへ遷移する
 */
/**
 * AppHeader の props。
 * backHref / backLabel を渡すとヘッダー左端に戻るリンクを表示する。
 */
type AppHeaderProps = {
  /** 戻るリンクの遷移先 URL */
  backHref?: string;
  /** 戻るリンクのラベル。省略時は "戻る" */
  backLabel?: string;
  /** アプリ名 "LabNoteApp" を表示するか。サイドバーに既に表示されるページでは false を渡す。デフォルト true */
  showLogo?: boolean;
};

export default function AppHeader({
  backHref,
  backLabel,
  showLogo = true,
}: AppHeaderProps = {}) {
  const pathname = usePathname();
  const router = useRouter();

  const [username, setUsername] = useState<string>("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  /** 未読通知数: requested_at > last_seen_at のもの */
  const [unreadCount, setUnreadCount] = useState(0);

  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  /** ポーリング用タイマー ID を useRef で保持する */
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ユーザー名を取得する
  useEffect(() => {
    authFetch("/api/auth/me").then((res) => {
      if (res.ok) {
        res.json().then((data) => setUsername(data.username ?? ""));
      }
    });
  }, []);

  /** 通知一覧を取得して未読数を算出する */
  async function fetchNotifications() {
    try {
      const res = await authFetch("/api/notifications");
      if (!res.ok) return;
      const data: Notification[] = await res.json();
      setNotifications(data);
      updateUnreadCount(data);
    } catch {
      // ポーリング失敗は静かに無視する
    }
  }

  /** localStorage の最終既読時刻より新しい通知を未読としてカウントし unreadCount にセットする */
  function updateUnreadCount(data: Notification[]) {
    const lastSeenStr = localStorage.getItem(LAST_SEEN_KEY);

    // 一度もベルを開いたことがない場合は全件未読とみなす
    if (!lastSeenStr) {
      setUnreadCount(data.length);
      return;
    }

    const lastSeenDate = new Date(lastSeenStr);

    const unread = data.filter((n) => {
      // 管理者向け申請通知: requested_at > last_seen なら未読
      if (n.type === "join_request") {
        if (!n.requested_at) return false;
        return new Date(n.requested_at) > lastSeenDate;
      }
      // 承認通知: approved_at > last_seen なら未読
      if (n.type === "join_request_approved") {
        if (!n.approved_at) return false;
        return new Date(n.approved_at) > lastSeenDate;
      }
      // 拒否通知: 存在する限り常に未読（ベルを開いたとき dismiss する）
      if (n.type === "join_request_rejected") {
        return true;
      }
      // プライベートノート招待: is_read=false のものを未読とする
      if (n.type === "private_note_invitation") {
        return !n.is_read;
      }
      return false;
    });

    setUnreadCount(unread.length);
  }

  // マウント時に初回フェッチ、その後 30 秒ごとにポーリングする
  useEffect(() => {
    fetchNotifications();
    pollTimerRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ベルポップオーバーを開閉する。開いたとき last_seen を更新してバッジを消す。 */
  function handleBellToggle() {
    if (!isBellOpen) {
      // 開いた瞬間に既読マークをつける
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      setUnreadCount(0);
      // 拒否通知をサーバーから削除する（確認済みとして処理）
      const hasRejected = notifications.some(
        (n) => n.type === "join_request_rejected",
      );
      if (hasRejected) {
        authFetch("/api/notifications/rejected", { method: "DELETE" }).catch(
          () => {},
        );
      }
      // プライベートノート招待通知の未読を既読にする
      notifications
        .filter(
          (n): n is PrivateNoteInvitationNotification =>
            n.type === "private_note_invitation" && !n.is_read,
        )
        .forEach((n) => {
          authFetch(`/api/notifications/${n.id}/read`, {
            method: "PATCH",
          }).catch(() => {});
        });
    }
    setIsBellOpen((v) => !v);
    setIsUserMenuOpen(false);
  }

  function handleUserMenuToggle() {
    setIsUserMenuOpen((v) => !v);
    setIsBellOpen(false);
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem(LAST_SEEN_KEY);
    router.push("/login");
  }

  return (
    <header className="shrink-0 h-12 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 gap-2 bg-background">
      {/* 左端: アプリ名 + 戻るリンク */}
      <div className="flex items-center gap-4">
        {showLogo && (
          <span className="text-lg font-bold tracking-tight">LabNoteApp</span>
        )}
        {backHref && (
          <Link
            href={backHref}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
          >
            {backLabel ?? "戻る"}
          </Link>
        )}
      </div>
      {/* 右端: ベルアイコン・ユーザーメニュー */}
      <div className="flex items-center gap-2">
        {/* ベルアイコン（通知ポップオーバー） */}
        <div className="relative">
          {isBellOpen && (
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsBellOpen(false)}
            />
          )}
          <button
            onClick={handleBellToggle}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="通知"
          >
            {/* ベルアイコン（SVG） */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-gray-600 dark:text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {/* 未読バッジ */}
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {/* 通知ポップオーバー */}
          {isBellOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg w-80">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-sm font-semibold">通知</p>
              </div>
              {notifications.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                  新しい通知はありません
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.map((n, i) => {
                    /* 管理者向け: 申請を承認・拒否するページへのリンク */
                    if (n.type === "join_request") {
                      return (
                        <li key={`req-${n.group_id}-${n.requester_user_id}`}>
                          <Link
                            href={`/organizations/${n.org_id}/groups/${n.group_id}/admin/members`}
                            onClick={() => setIsBellOpen(false)}
                            className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                              <span className="font-medium">
                                {n.requester_username}
                              </span>
                              {" さんが "}
                              <span className="font-medium">
                                {n.group_name}
                              </span>
                              {" への参加を申請しました"}
                            </p>
                            {n.requested_at && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatDateTime(n.requested_at)}
                              </p>
                            )}
                          </Link>
                        </li>
                      );
                    }

                    /* 申請者向け: 承認されたらグループのノートページへ遷移 */
                    if (n.type === "join_request_approved") {
                      return (
                        <li key={`approved-${n.group_id}-${i}`}>
                          <Link
                            href={`/organizations/${n.org_id}/groups/${n.group_id}/notes`}
                            onClick={() => setIsBellOpen(false)}
                            className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                              <span className="font-medium">
                                {n.group_name}
                              </span>
                              {" への参加が承認されました"}
                            </p>
                            {n.approved_at && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatDateTime(n.approved_at)}
                              </p>
                            )}
                          </Link>
                        </li>
                      );
                    }

                    /* 申請者向け: 拒否された（リンクなし、メッセージのみ） */
                    if (n.type === "join_request_rejected") {
                      return (
                        <li key={`rejected-${n.group_id}-${i}`}>
                          <div className="px-4 py-3">
                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                              <span className="font-medium">
                                {n.group_name}
                              </span>
                              {" への参加申請が却下されました"}
                            </p>
                            {n.rejected_at && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {formatDateTime(n.rejected_at)}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    }

                    /* プライベートノート招待: リンク先ノートへ遷移 */
                    if (n.type === "private_note_invitation") {
                      const inner = (
                        <div className="px-4 py-3">
                          <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                            {n.message}
                          </p>
                          {n.created_at && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatDateTime(n.created_at)}
                            </p>
                          )}
                        </div>
                      );
                      return (
                        <li key={`invite-${n.id}`}>
                          {n.link_url ? (
                            <Link
                              href={n.link_url}
                              onClick={() => setIsBellOpen(false)}
                              className="block hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              {inner}
                            </Link>
                          ) : (
                            inner
                          )}
                        </li>
                      );
                    }

                    return null;
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ユーザーメニュー */}
        {username && (
          <div className="relative">
            {isUserMenuOpen && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsUserMenuOpen(false)}
              />
            )}
            {/* トリガー: アイコン + 省略ユーザー名 */}
            <button
              onClick={handleUserMenuToggle}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-semibold shrink-0">
                {username.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-28 truncate text-sm text-gray-600 dark:text-gray-300">
                {username}
              </span>
            </button>
            {/* ポップオーバーメニュー */}
            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 min-w-48 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 text-base font-semibold shrink-0">
                    {username.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-base font-medium break-all">
                    {username}
                  </span>
                </div>
                <div>
                  <Link
                    href={`/settings?returnTo=${encodeURIComponent(pathname)}`}
                    className="w-full text-left px-3 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    設定
                  </Link>
                </div>
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
