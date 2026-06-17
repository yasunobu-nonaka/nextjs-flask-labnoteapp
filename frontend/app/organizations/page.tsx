"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";

type Organization = {
  id: number;
  name: string;
  role: string;
};

/**
 * 組織一覧ページ
 * ログインユーザーが所属する組織を表示し、新規組織の作成を行う。
 * 組織をクリックするとグループ一覧ページに遷移する。
 */
export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規組織作成フォームの入力値と送信状態
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const router = useRouter();

  // マウント時に所属組織一覧を取得する
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const res = await authFetch("/api/organizations");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError("組織の取得に失敗しました");
          setLoading(false);
          return;
        }
        const data: Organization[] = await res.json();
        setOrganizations(data);
      } catch {
        setError("サーバーへの接続に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchOrganizations();
  }, [router]);

  // 組織を新規作成してリストに追加する
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newOrgName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await authFetch("/api/organizations", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const json = await res.json();
        setCreateError(json.message ?? "作成に失敗しました");
        return;
      }
      const json = await res.json();
      setOrganizations((prev) => [...prev, { ...json.organization, role: "owner" }]);
      setNewOrgName("");
    } catch {
      setCreateError("サーバーへの接続に失敗しました");
    } finally {
      setIsCreating(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">組織一覧</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-base hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ログアウト
          </button>
        </div>

        {/* 新規組織作成フォーム */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">組織を作成</h2>
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="組織名"
              className="flex-1 px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
            />
            <button
              type="submit"
              disabled={isCreating || !newOrgName.trim()}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isCreating ? "作成中..." : "作成"}
            </button>
          </form>
          {createError && <p className="text-sm text-red-500">{createError}</p>}
        </section>

        {/* 組織一覧 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">所属組織</h2>
          {loading ? (
            <p className="text-gray-500 text-base">読み込み中...</p>
          ) : error ? (
            <p className="text-red-500 text-sm">{error}</p>
          ) : organizations.length === 0 ? (
            <p className="text-gray-500 text-base">所属している組織がありません。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {organizations.map((org) => (
                <li key={org.id}>
                  {/* 組織カード: クリックでグループ一覧へ遷移する */}
                  <Link
                    href={`/organizations/${org.id}/groups`}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm transition-all"
                  >
                    <span className="text-base font-medium">{org.name}</span>
                    <span className="text-sm text-gray-400">{org.role}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
