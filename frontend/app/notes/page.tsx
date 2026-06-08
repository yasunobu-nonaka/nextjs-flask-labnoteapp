"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import FolderSidebar from "@/components/FolderSidebar";
import { type Folder, buildFolderOptions } from "@/lib/folders";

type Note = {
  id: number;
  title: string;
  content_md: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  folder_id: number | null;
};

type NotesResponse = {
  notes: Note[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

type Status = "loading" | "success" | "error";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
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

  function handleNoteMoved() {
    setRefreshKey((k) => k + 1);
  }

  function handleTagToggle(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
    setCurrentPage(1);
  }

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

  const isFiltering = !!submittedQuery || selectedTags.length > 0;

  return (
    <main className="min-h-screen bg-background text-foreground flex">
      <FolderSidebar
        selectedFolderId={selectedFolderId}
        onSelectFolder={handleSelectFolder}
      />
      <div className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
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

function NoteCard({
  note,
  selectedTags,
  onTagToggle,
  folders,
  onMoved,
}: {
  note: Note;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  folders: Folder[];
  onMoved: () => void;
}) {
  // "idle" | "menu" | "moving" の3状態で表示を切り替える
  const [mode, setMode] = useState<"idle" | "menu" | "moving">("idle");
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);

  const date = new Date(note.updated_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleMove() {
    const res = await authFetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      body: JSON.stringify({ folder_id: targetFolderId }),
    });
    if (res.ok) {
      setMode("idle");
      onMoved();
    }
  }

  return (
    <li className="relative flex flex-col gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
      {/* メニュー表示中は背景オーバーレイでクリック外を検知して閉じる */}
      {mode === "menu" && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMode("idle")} />
          <div className="absolute right-4 top-10 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-36">
            <button
              onClick={() => {
                setTargetFolderId(note.folder_id);
                setMode("moving");
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              移動
            </button>
          </div>
        </>
      )}

      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/notes/${note.id}`}
          className="font-semibold text-lg leading-snug hover:underline"
        >
          {note.title}
        </Link>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <span className="text-xs text-gray-400">{date}</span>
          <button
            onClick={() => setMode(mode === "menu" ? "idle" : "menu")}
            className="px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm leading-none"
            title="メニュー"
          >
            ···
          </button>
        </div>
      </div>

      {/* 移動フォーム */}
      {mode === "moving" && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={targetFolderId ?? ""}
            onChange={(e) =>
              setTargetFolderId(e.target.value ? Number(e.target.value) : null)
            }
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 focus:outline-none"
          >
            <option value="">Home</option>
            {buildFolderOptions(folders).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleMove}
            className="px-3 py-1 text-sm rounded bg-foreground text-background hover:opacity-80 transition-opacity"
          >
            移動
          </button>
          <button
            onClick={() => setMode("idle")}
            className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            キャンセル
          </button>
        </div>
      )}

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagToggle(tag)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-foreground text-background"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
