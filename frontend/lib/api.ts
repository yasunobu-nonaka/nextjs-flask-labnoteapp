/**
 * アクセストークンが切れていた場合にリフレッシュトークンで自動更新し、
 * 成功したら元のリクエストをリトライする fetch ラッパー。
 *
 * - 401 を受け取ったとき → /api/auth/refresh を叩いて新しいアクセストークンを取得
 * - リフレッシュ成功 → 新トークンを localStorage に保存して元のリクエストをリトライ
 * - リフレッシュ失敗（refresh_token も切れ） → localStorage をクリアして login へリダイレクト
 */
export async function authFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetchWithToken(path, init);

  // 401 以外はそのまま返す
  if (response.status !== 401) {
    return response;
  }

  // アクセストークン切れ → リフレッシュを試みる
  const refreshed = await tryRefresh();
  if (!refreshed) {
    // リフレッシュも失敗（refresh_token が切れているなど）→ ログアウト
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
    // リダイレクト中なので呼び出し元には 401 をそのまま返す
    return response;
  }

  // 新しいアクセストークンで元のリクエストをリトライ
  return fetchWithToken(path, init);
}

/** アクセストークンを Authorization ヘッダーに付けてリクエストする */
function fetchWithToken(path: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("access_token");
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

/**
 * リフレッシュトークンを使って新しいアクセストークンを取得し localStorage に保存する。
 * 成功したら true、失敗したら false を返す。
 */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    return false;
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
      },
    );

    if (!res.ok) {
      return false;
    }

    const json = await res.json();
    localStorage.setItem("access_token", json.access_token);
    return true;
  } catch {
    return false;
  }
}
