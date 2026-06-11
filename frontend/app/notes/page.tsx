"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import FolderSidebar from "@/components/FolderSidebar";
import FolderCard from "@/components/FolderCard";
import NoteCard, { type Note } from "@/components/NoteCard";
import { type Folder } from "@/lib/folders";

type NotesResponse = {
  notes: Note[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export default function NotesPage() {
  // ノート一覧と取得状態
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

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

  // フォルダーナビゲーション: null = ルート（フォルダー未所属ノートを表示）
  // selectedFolderId ではなく "どのフォルダーにいるか" という位置情報として扱う
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  // 全フォルダー一覧: ブレッドクラム構築・カレントレベル算出・NoteCard の移動先に使う
  const [allFolders, setAllFolders] = useState<Folder[]>([]);

  // フォルダー新規作成のインラインフォーム
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // NoteCard の移動後にノート一覧を再フェッチするためのトリガー
  const [refreshKey, setRefreshKey] = useState(0);

  const router = useRouter();

  // トークンを削除してログインページへ遷移する
  function handleLogout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  // キーワード検索・タグフィルターをリセットして1ページ目に戻る（フォルダー位置は維持）
  function handleClear() {
    setQuery("");
    setSubmittedQuery("");
    setSelectedTags([]);
    setCurrentPage(1);
  }

  // フォルダーに移動して1ページ目に戻る（検索・タグフィルターは維持する）
  function handleNavigate(folderId: number | null) {
    setCurrentFolderId(folderId);
    setCurrentPage(1);
  }

  // NoteCard からノート移動完了の通知を受け取り、リストを再フェッチする
  function handleNoteMoved() {
    setRefreshKey((k) => k + 1);
  }

  // タグの選択状態を切り替えて1ページ目に戻る
  // すでに選択中なら除去し、未選択なら追加する
  function handleTagToggle(tag: string) {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
    setCurrentPage(1);
  }

  // 全フォルダーを取得して allFolders を更新する（FolderCard の CRUD 後にも呼ぶ）
  const fetchAllFolders = useCallback(async () => {
    const res = await authFetch("/api/folders");
    if (res.ok) {
      const data: Folder[] = await res.json();
      setAllFolders(data);
    }
  }, []);

  // マウント時に一度だけタグ一覧とフォルダー一覧を取得する
  useEffect(() => {
    async function fetchTags() {
      const res = await authFetch("/api/notes/tags");
      if (res.ok) {
        const data: string[] = await res.json();
        setAvailableTags(data);
      }
    }
    fetchTags();
    fetchAllFolders();
  }, [fetchAllFolders]);

  // 検索条件・フィルター・ページ・フォルダー位置・移動トリガーが変わるたびにノート一覧を再取得する
  // currentFolderId が null のときは "null" 文字列を送り、フォルダー未所属ノートのみ取得する
  useEffect(() => {
    async function fetchNotes() {
      setNotesLoading(true);
      setNotesError(null);
      try {
        // APIクエリパラメータを組み立てる
        const params = new URLSearchParams();

        if (submittedQuery) {
          params.set("q", submittedQuery);
        }

        selectedTags.forEach((tag) => params.append("tag", tag));

        if (currentFolderId === null) {
          params.set("folder_id", "null");
        } else {
          params.set("folder_id", String(currentFolderId));
        }

        params.set("page", String(currentPage));

        const res = await authFetch(`/api/notes?${params.toString()}`);

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (!res.ok) {
          setNotesError("ノートの取得に失敗しました");
          setNotesLoading(false);
          return;
        }

        const data: NotesResponse = await res.json();
        setNotes(data.notes);
        setTotalPages(data.total_pages);
      } catch {
        setNotesError("サーバーへの接続に失敗しました");
      } finally {
        setNotesLoading(false);
      }
    }

    fetchNotes();
  }, [
    router,
    submittedQuery,
    selectedTags,
    currentFolderId,
    currentPage,
    refreshKey,
  ]);

  // 現在のフォルダーレベルの直下フォルダー（parent_id が currentFolderId と一致するもの）
  const currentLevelFolders = allFolders.filter(
    (f) => f.parent_id === currentFolderId,
  );

  // ルートから現在フォルダーまでのパスを返す（ブレッドクラム表示用）
  // 例: [{ id: null, name: "ルート" }, { id: 1, name: "Project A" }, { id: 3, name: "Experiment 1" }]
  function getBreadcrumb(): Array<{ id: number | null; name: string }> {
    const path: Array<{ id: number | null; name: string }> = [];
    let current: number | null = currentFolderId;

    // 現在地から出発して親をたどりながらルートまで逆順に登り、最終的に正順（ルートから現在地）の配列を返す
    while (current !== null) {
      const folder = allFolders.find((f) => f.id === current);
      if (!folder) break;
      path.unshift({ id: folder.id, name: folder.name });
      current = folder.parent_id;
    }
    return [{ id: null, name: "ルート" }, ...path];
  }

  // 現在のフォルダー位置にフォルダーを新規作成する
  async function handleCreateFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const res = await authFetch("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: trimmed, parent_id: currentFolderId }),
    });
    if (res.ok) {
      setIsCreatingFolder(false);
      setNewFolderName("");
      fetchAllFolders();
    }
  }

  const breadcrumb = getBreadcrumb();
  // 検索・タグフィルターが有効かどうか（フィルターバナーの表示判定に使う）
  const isFiltering = !!submittedQuery || selectedTags.length > 0;

  return (
    <main className="min-h-screen bg-background text-foreground flex">
      {/* 左カラム: 検索・タグフィルターサイドバー */}
      <FolderSidebar
        query={query}
        onQueryChange={setQuery}
        onSearch={() => {
          setSubmittedQuery(query.trim());
          setCurrentPage(1);
        }}
        selectedTags={selectedTags}
        availableTags={availableTags}
        onTagToggle={handleTagToggle}
      />

      {/* 右カラム: メインコンテンツ */}
      <div className="flex-1 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {/* ページヘッダー: タイトル・新規作成ボタン・フォルダー作成ボタン・ログアウトボタン */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">ノート一覧</h1>
            <div className="flex gap-2">
              <Link
                href={
                  currentFolderId
                    ? `/notes/new?folder_id=${currentFolderId}`
                    : "/notes/new"
                }
                className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
              >
                新規作成
              </Link>
              <button
                onClick={() => setIsCreatingFolder(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-base hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                + フォルダー
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-base hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>

          {/* ブレッドクラム: ルート > フォルダー A > ... （階層を示し、クリックで上に戻れる） */}
          <nav
            aria-label="フォルダーの階層"
            className="flex items-center gap-1 text-base text-gray-500 flex-wrap"
          >
            {breadcrumb.map((item, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <span
                  key={item.id ?? "root"}
                  className="flex items-center gap-1"
                >
                  {index > 0 && (
                    <span className="text-gray-400 select-none">›</span>
                  )}
                  {isLast ? (
                    // 現在位置は強調表示し、クリック不可
                    <span className="text-foreground font-medium">
                      {item.name}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleNavigate(item.id)}
                      className="hover:underline hover:text-foreground transition-colors"
                    >
                      {item.name}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>

          {/* フィルター中バナー: 適用中の条件表示・クリアボタン */}
          {isFiltering && (
            <div className="flex flex-wrap items-center gap-3 text-base text-gray-500">
              {submittedQuery && <span>「{submittedQuery}」の検索結果</span>}
              {selectedTags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span>タグ:</span>
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-foreground text-background text-sm"
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

          {/* コンテンツ一覧: フォルダー → ノートの順に表示 */}
          <div className="flex flex-col gap-4">
            {/* フォルダー新規作成のインラインフォーム（「+ フォルダー」ボタン押下時に表示） */}
            {isCreatingFolder && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateFolder();
                }}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600"
              >
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="フォルダー名"
                  className="flex-1 px-2 py-0.5 text-base bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="text-sm text-blue-500 hover:underline shrink-0"
                >
                  作成
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                  }}
                  className="text-sm text-gray-400 hover:underline shrink-0"
                >
                  ✕
                </button>
              </form>
            )}

            {/* 現在のフォルダーレベルの直下フォルダー: グリッドで並べる */}
            {currentLevelFolders.length > 0 && (
              <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentLevelFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onNavigate={handleNavigate}
                    onMutation={fetchAllFolders}
                  />
                ))}
              </ul>
            )}

            {/* ノート一覧（ローディング・エラー・空状態・カード） */}
            {notesLoading ? (
              <p className="text-gray-500 text-base">読み込み中...</p>
            ) : notesError ? (
              <p className="text-red-500 text-sm">{notesError}</p>
            ) : notes.length === 0 && currentLevelFolders.length === 0 ? (
              // フォルダーもノートも存在しない場合にのみ空状態メッセージを表示
              <p className="text-gray-500">
                {isFiltering
                  ? "該当するノートが見つかりませんでした。"
                  : "ノートがありません。"}
              </p>
            ) : notes.length > 0 ? (
              <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    selectedTags={selectedTags}
                    onTagToggle={handleTagToggle}
                    folders={allFolders}
                    onMoved={handleNoteMoved}
                  />
                ))}
              </ul>
            ) : null}
          </div>

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
              <span className="text-base text-gray-500">
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
