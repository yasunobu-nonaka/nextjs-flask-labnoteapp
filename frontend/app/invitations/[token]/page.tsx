"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import { ORG_ROLE_LABELS } from "@/lib/constants";

type InvitationData = {
  token: string;
  email: string;
  organization_id: number;
  organization_name: string;
  invited_by_username: string;
  role: string;
  status: string;
  expires_at: string;
};


/**
 * 招待承認ページ。
 * メールのリンクから遷移するページ。招待内容を表示し、ログイン済みユーザーが承認できる。
 * 未ログインの場合はログイン・新規登録へ誘導し、ログイン後にこのページへ戻る。
 */
export default function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  // 招待詳細の取得状態
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ログイン状態と承認フローの状態
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [joinedOrgId, setJoinedOrgId] = useState<number | null>(null);

  // マウント時にログイン状態を確認し、招待詳細を取得する
  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("access_token"));

    async function fetchInvitation() {
      try {
        // GET /api/invitations/{token} は認証不要
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/${token}`
        );
        if (res.status === 404) {
          setFetchError("招待が見つかりません。URLをご確認ください。");
          return;
        }
        if (res.status === 400) {
          const json = await res.json();
          setFetchError(json.message ?? "この招待は無効または期限切れです。");
          return;
        }
        if (!res.ok) {
          setFetchError("招待の取得に失敗しました。");
          return;
        }
        const data: InvitationData = await res.json();
        setInvitation(data);
      } catch {
        setFetchError("サーバーへの接続に失敗しました。");
      } finally {
        setLoading(false);
      }
    }
    fetchInvitation();
  }, [token]);

  /**
   * ログインページへ遷移する前に、ログイン後の戻り先を localStorage に保存する。
   * ログインページはログイン成功後にこのパスを読み取って戻ってくる。
   */
  function handleGoToLogin() {
    localStorage.setItem("redirect_after_login", `/invitations/${token}`);
    router.push("/login");
  }

  function handleGoToRegister() {
    localStorage.setItem("redirect_after_login", `/invitations/${token}`);
    router.push("/register");
  }

  /** 招待を承認してログインユーザーを組織に追加する */
  async function handleAccept() {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await authFetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        setAccepted(true);
        setJoinedOrgId(json.organization_id);
      } else if (res.status === 401) {
        router.push("/login");
      } else {
        setAcceptError(json.message ?? "承認に失敗しました。");
      }
    } catch {
      setAcceptError("サーバーへの接続に失敗しました。");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground px-4">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* ヘッダー */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">組織への招待</h1>
          <p className="text-sm text-gray-500">Lab Note App</p>
        </div>

        {/* コンテンツカード */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col gap-5 bg-white dark:bg-gray-900">
          {loading ? (
            <p className="text-gray-500">読み込み中...</p>
          ) : fetchError ? (
            /* 招待が無効・期限切れの場合 */
            <div className="flex flex-col gap-4">
              <p className="text-red-500 text-sm">{fetchError}</p>
              <Link
                href="/organizations"
                className="text-sm underline text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                トップページに戻る
              </Link>
            </div>
          ) : accepted ? (
            /* 承認成功 */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-green-600 dark:text-green-400">
                  ✓ 組織に参加しました
                </p>
                <p className="text-sm text-gray-500">
                  {invitation?.organization_name} のメンバーになりました。
                </p>
              </div>
              {joinedOrgId && (
                <Link
                  href={`/organizations/${joinedOrgId}/groups`}
                  className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity text-center"
                >
                  グループ一覧を見る
                </Link>
              )}
            </div>
          ) : (
            /* 招待詳細と承認アクション */
            <>
              <div className="flex flex-col gap-3">
                {/* 招待詳細 */}
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">組織</dt>
                    <dd className="font-medium">{invitation?.organization_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">付与されるロール</dt>
                    <dd>{ORG_ROLE_LABELS[invitation?.role ?? ""] ?? invitation?.role}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">招待者</dt>
                    <dd>{invitation?.invited_by_username}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">招待先メール</dt>
                    <dd className="text-gray-600 dark:text-gray-400">{invitation?.email}</dd>
                  </div>
                </dl>
              </div>

              {acceptError && (
                <p className="text-sm text-red-500">{acceptError}</p>
              )}

              {isLoggedIn ? (
                /* ログイン済み: 承認ボタン */
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {accepting ? "承認中..." : "参加する"}
                </button>
              ) : (
                /* 未ログイン: ログイン・新規登録へ誘導 */
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-500">
                    参加するにはログインまたは新規登録が必要です。
                  </p>
                  <button
                    onClick={handleGoToLogin}
                    className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
                  >
                    ログインして参加する
                  </button>
                  <button
                    onClick={handleGoToRegister}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-base hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    新規登録して参加する
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
