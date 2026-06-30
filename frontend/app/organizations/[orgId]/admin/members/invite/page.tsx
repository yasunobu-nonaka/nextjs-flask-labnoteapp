"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";

type EntryStatus = "idle" | "sending" | "sent" | "error";

type Entry = {
  /** クライアントサイドのみで使うキー */
  id: number;
  email: string;
  role: string;
  status: EntryStatus;
  message: string;
};

const ROLES = [
  { value: "member", label: "メンバー" },
  { value: "user_admin", label: "ユーザー管理者" },
  { value: "sys_admin", label: "システム管理者" },
];

/**
 * 組織管理: メンバー招待ページ。
 * 任意の数のメールアドレスとロールを入力して招待メールを送信できる。
 * 各行ごとに送信結果（成功・失敗）をインラインで表示する。
 */
export default function InviteMembersPage() {
  const { orgId } = useParams<{ orgId: string }>();

  // nextId をモジュールレベルに置くと Strict Mode の二重レンダリングで
  // サーバー/クライアント間のカウントがずれハイドレーション不一致が起きるため useRef で管理する
  const nextId = useRef(1);

  const [entries, setEntries] = useState<Entry[]>([
    { id: 0, email: "", role: "member", status: "idle", message: "" },
  ]);
  const [isSending, setIsSending] = useState(false);
  // SSR とクライアントの初回レンダリングを一致させるためのフラグ。
  // ルーターキャッシュが古いDOM状態を保持している場合でも、マウント前は常に
  // disabled=true を返すことでハイドレーション不一致を防ぐ。
  const [mounted, setMounted] = useState(false);
  // SSR/CSR ハイドレーション不一致防止のためのマウントフラグ（意図的な同期 setState）
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  /** 指定 id のエントリを部分更新する */
  function updateEntry(id: number, patch: Partial<Entry>) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }

  /** 行を追加する */
  function addEntry() {
    const id = nextId.current++;
    setEntries((prev) => [
      ...prev,
      { id, email: "", role: "member", status: "idle", message: "" },
    ]);
  }

  /** 行を削除する（最低1行は残す） */
  function removeEntry(id: number) {
    setEntries((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((e) => e.id !== id);
    });
  }

  /**
   * 全エントリを順次送信する。
   * 各行を個別に POST し、成功・失敗を行ごとに更新する。
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validEntries = entries.filter((en) => en.email.trim());
    if (validEntries.length === 0) return;

    setIsSending(true);

    for (const entry of validEntries) {
      updateEntry(entry.id, { status: "sending", message: "" });
      try {
        const res = await authFetch(`/api/organizations/${orgId}/invitations`, {
          method: "POST",
          body: JSON.stringify({ email: entry.email.trim(), role: entry.role }),
        });
        const json = await res.json();
        if (res.ok) {
          updateEntry(entry.id, {
            status: "sent",
            message: "招待メールを送信しました",
          });
        } else {
          updateEntry(entry.id, {
            status: "error",
            message: json.message ?? "送信に失敗しました",
          });
        }
      } catch {
        updateEntry(entry.id, {
          status: "error",
          message: "サーバーへの接続に失敗しました",
        });
      }
    }

    setIsSending(false);
  }

  const hasValidEntry = entries.some((e) => e.email.trim());

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-1">
        <Link
          href={`/organizations/${orgId}/admin/members`}
          className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          ← メンバー一覧に戻る
        </Link>
        <h2 className="text-2xl font-bold mt-1">メンバーを招待</h2>
        <p className="text-base text-gray-500 dark:text-gray-400">
          招待したいメンバーのメールアドレスとロールを入力してください。
        </p>
      </div>

      {/* 招待フォーム */}
      {/* autoComplete="off": リロード時にブラウザがフォーム値を復元してハイドレーション不一致を起こすのを防ぐ */}
      <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
        {/* カラムヘッダー */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-1">
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            メールアドレス
          </span>
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 w-40">
            ロール
          </span>
          {/* 削除ボタン列のスペース確保 */}
          <span className="w-8" />
        </div>

        {/* 入力行: メールアドレス + ロール + 削除 + ステータス */}
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                {/* メールアドレス入力 */}
                <input
                  type="email"
                  value={entry.email}
                  onChange={(e) =>
                    updateEntry(entry.id, {
                      email: e.target.value,
                      status: "idle",
                      message: "",
                    })
                  }
                  placeholder="example@example.com"
                  autoComplete="off"
                  disabled={entry.status === "sending" || entry.status === "sent"}
                  className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-60"
                />
                {/* ロール選択 */}
                <select
                  value={entry.role}
                  onChange={(e) =>
                    updateEntry(entry.id, { role: e.target.value })
                  }
                  disabled={entry.status === "sending" || entry.status === "sent"}
                  className="w-40 px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-60"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {/* 行削除ボタン */}
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  disabled={entries.length <= 1 || entry.status === "sending"}
                  className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                  aria-label="行を削除"
                >
                  ✕
                </button>
              </div>

              {/* 行ごとの送信結果 */}
              {entry.status === "sending" && (
                <p className="text-sm text-gray-400 pl-1">送信中...</p>
              )}
              {entry.status === "sent" && (
                <p className="text-sm text-green-600 dark:text-green-400 pl-1">
                  ✓ {entry.message}
                </p>
              )}
              {entry.status === "error" && (
                <p className="text-sm text-red-500 pl-1">✕ {entry.message}</p>
              )}
            </div>
          ))}
        </div>

        {/* 行追加ボタン */}
        <div>
          <button
            type="button"
            onClick={addEntry}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 transition-colors"
          >
            + 行を追加
          </button>
        </div>

        {/* 送信ボタン */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!mounted || isSending || !hasValidEntry}
            className="px-5 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isSending ? "送信中..." : "招待メールを送信"}
          </button>
          <Link
            href={`/organizations/${orgId}/admin/members`}
            className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-base hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
