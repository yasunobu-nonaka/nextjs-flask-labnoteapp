"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import FolderSidebar from "@/components/FolderSidebar";
import { type Folder } from "@/lib/folders";
import NoteCard, { type Note } from "@/components/NoteCard";

type NotesResponse = {
  notes: Note[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

type Status = "loading" | "success" | "error";

export default function NotesPage() {
  // ノート一覧と取得状態
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  // キーワード検索: query は入力中の値、submittedQuery は検索ボタン押下時に確定した値。
  // submittedQuery が変わったタイミングだけ API を叩くことで、キー入力のたびに
  // リクエストが飛ぶのを防いでいる。
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  // タグフィルター: selectedTags はチェック中のタグ、availableTags は選択肢一覧
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // フォルダーフィルター: null は「すべてのノート」を意味する
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  // NoteCard の移動フォームで使うフォルダー一覧（FolderSidebar とは独立して取得）
  const [folders, setFolders] = useState<Folder[]>([]);

  // ノート移動後にリストを再フェッチするためのトリガー。
  // increment すると useEffect の依存配列が変わり、fetchNotes が再実行される。
  const [refreshKey, setRefreshKey] = useState(0);

  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  function handleClear() {
    setQuery("");
    setSubmittedQuery("");
    setSelectedTags([]);
    setCurrentPage(1);
  }

  function handleSelectFolder(id: number | null) {
    setSelectedFolderId(id);
    setCurrentPage(1);
  }

  // NoteCard からノート移動完了の通知を受け取り、リストを再フェッチする
  function handleNoteMoved() {
    setRefreshKey((k) => k + 1);
  }

  function handleTagToggle(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
    setCurrentPage(1);
  }

  // マウント時に一度だけタグ一覧とフォルダー一覧を取得する
  useEffect(() => {
    async function fetchTags() {
      const res = await authFetch("/api/notes/tags");
      if (res.ok) {
        const data: string[] = await res.json();
        setAvailableTags(data);
      }
    }
    async function fetchFolders() {
      const res = await authFetch("/api/folders");
      if (res.ok) {
        const data: Folder[] = await res.json();
        setFolders(data);
      }
    }
    fetchTags();
    fetchFolders();
  }, []);

  // 検索条件・フィルター・ページ・移動トリガーが変わるたびにノート一覧を再取得する
  useEffect(() => {
    async function fetchNotes() {
      setStatus("loading");
      try {
        const params = new URLSearchParams();
        if (submittedQuery) params.set("q", submittedQuery);
        selectedTags.forEach((tag) => params.append("tag", tag));
        if (selectedFolderId !== null)
          params.set("folder_id", String(selectedFolderId));
        params.set("page", String(currentPage));
        const res = await authFetch(`/api/notes?${params.toString()}`);

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (!res.ok) {
          setError("ノートの取得に失敗しました");
          setStatus("error");
          return;
        }

        const data: NotesResponse = await res.json();
        setNotes(data.notes);
        setTotalPages(data.total_pages);
        setStatus("success");
      } catch {
        setError("サーバーへの接続に失敗しました");
        setStatus("error");
      }
    }

    fetchNotes();
  }, [
    router,
    submittedQuery,
    selectedTags,
    selectedFolderId,
    currentPage,
    refreshKey,
  ]);

  if (status === "loading") {
    return (
      <main className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  // 検索・タグフィルターが有効かどうか（フィルターバナーの表示判定に使う）
  const isFiltering = !!submittedQuery || selectedTags.length > 0;

  return (
    <main className="min-h-screen bg-background text-foreground flex">
      {/* 左カラム: フォルダーサイドバー */}
      <FolderSidebar
        selectedFolderId={selectedFolderId}
        onSelectFolder={handleSelectFolder}
      />

      {/* 右カラム: メインコンテンツ */}
      <div className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">

          {/* ページヘッダー: タイトル・新規作成ボタン・ログアウトボタン */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">ノート一覧</h1>
            <div className="flex gap-2">
              <Link
                href={
                  selectedFolderId
                    ? `/notes/new?folder_id=${selectedFolderId}`
                    : "/notes/new"
                }
                className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                新規作成
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>

          {/* キーワード検索フォーム */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedQuery(query.trim());
              setCurrentPage(1);
            }}
            className="flex gap-2"
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="タイトルで検索..."
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-foreground text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              検索
            </button>
          </form>

          {/* タグフィルター: チェックボックス一覧 */}
          {availableTags.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-500">タグで絞り込む:</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {availableTags.map((tag) => (
                  <label
                    key={tag}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => handleTagToggle(tag)}
                      className="rounded border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* フィルター中バナー: 適用中の条件表示・クリアボタン */}
          {isFiltering && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
              {submittedQuery && <span>「{submittedQuery}」の検索結果</span>}
              {selectedTags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span>タグ:</span>
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-foreground text-background text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={handleClear}
                className="underline hover:text-foreground transition-colors ml-auto"
              >
                すべてクリア
              </button>
            </div>
          )}

          {/* ノート一覧 または 空状態メッセージ */}
          {notes.length === 0 ? (
            <p className="text-gray-500">
              {isFiltering
                ? "該当するノートが見つかりませんでした。"
                : "ノートがありません。"}
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  selectedTags={selectedTags}
                  onTagToggle={handleTagToggle}
                  folders={folders}
                  onMoved={handleNoteMoved}
                />
              ))}
            </ul>
          )}

          {/* ページネーション: 複数ページあるときだけ表示 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                前へ
              </button>
              <span className="text-sm text-gray-500">
                {currentPage} / {totalPages} ページ
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                次へ
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
