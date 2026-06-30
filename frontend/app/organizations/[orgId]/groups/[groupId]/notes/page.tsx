"use client";

import { useCallback, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import FolderSidebar from "@/components/folder/FolderSidebar";
import FolderCard from "@/components/folder/FolderCard";
import NoteCard, { type Note } from "@/components/note/NoteCard";
import FolderCreateModal from "@/components/folder/FolderCreateModal";
import NewItemButton from "@/components/note/NewItemButton";
import FolderBreadcrumb from "@/components/folder/FolderBreadcrumb";
import { type Folder } from "@/lib/folders";

type NotesResponse = {
  notes: Note[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

/**
 * ノート一覧ページ（グループスコープ版）
 * 指定された組織・グループ内のノートとフォルダーをファイルブラウザー形式で表示する。
 * フォルダーナビゲーション・キーワード検索・タグフィルター・ページネーションに対応。
 * ユーザーメニューとベル通知は AppHeader に移譲している。
 */
export default function NotesPage() {
  const { orgId, groupId } = useParams<{ orgId: string; groupId: string }>();
  const orgIdNum = Number(orgId);
  const groupIdNum = Number(groupId);

  // グループ名（ページタイトル用）
  const [groupName, setGroupName] = useState<string>("");

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
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  // 全フォルダー一覧: ブレッドクラム構築・カレントレベル算出・NoteCard の移動先に使う
  const [allFolders, setAllFolders] = useState<Folder[]>([]);

  // フォルダー新規作成モーダルの開閉（NewItemButton → FolderCreateModal のブリッジ）
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // NoteCard の移動後にノート一覧を再フェッチするためのトリガー
  const [refreshKey, setRefreshKey] = useState(0);

  // API が 404 を返したとき（非メンバー・private グループ非メンバー）に true にする
  const [isNotFound, setIsNotFound] = useState(false);

  const router = useRouter();

  // このページを訪れたことを記録し、設定画面などから戻れるようにする
  useEffect(() => {
    localStorage.setItem(
      "last_notes_url",
      `/organizations/${orgId}/groups/${groupId}/notes`,
    );
  }, [orgId, groupId]);

  // グループ情報を取得してグループ名をセットする
  useEffect(() => {
    async function fetchGroupName() {
      const res = await authFetch(
        `/api/organizations/${orgIdNum}/groups/${groupIdNum}`,
      );
      if (res.ok) {
        const data = await res.json();
        setGroupName(data.name ?? "");
      }
    }
    fetchGroupName();
  }, [orgIdNum, groupIdNum]);

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
    const res = await authFetch(
      `/api/organizations/${orgIdNum}/groups/${groupIdNum}/folders`,
    );
    if (res.ok) {
      const data: Folder[] = await res.json();
      setAllFolders(data);
    }
  }, [orgIdNum, groupIdNum]);

  // マウント時に一度だけタグ一覧とフォルダー一覧を取得する
  useEffect(() => {
    async function fetchTags() {
      const res = await authFetch(
        `/api/organizations/${orgIdNum}/groups/${groupIdNum}/notes/tags`,
      );
      if (res.ok) {
        const data: string[] = await res.json();
        setAvailableTags(data);
      }
    }
    fetchTags();
    // fetchAllFolders は useCallback で安定化済みの非同期関数（内部の setState は非同期）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAllFolders();
  }, [orgIdNum, groupIdNum, fetchAllFolders]);

  // 検索条件・フィルター・ページ・フォルダー位置・移動トリガーが変わるたびにノート一覧を再取得する
  useEffect(() => {
    async function fetchNotes() {
      setNotesLoading(true);
      setNotesError(null);
      try {
        const params = new URLSearchParams();
        if (submittedQuery) params.set("q", submittedQuery);
        selectedTags.forEach((tag) => params.append("tag", tag));
        params.set(
          "folder_id",
          currentFolderId === null ? "null" : String(currentFolderId),
        );
        params.set("page", String(currentPage));

        const res = await authFetch(
          `/api/organizations/${orgIdNum}/groups/${groupIdNum}/notes?${params.toString()}`,
        );

        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          setNotesError(
            "このグループのメンバーではありません。グループ一覧からメンバー参加を申請してください。",
          );
          setNotesLoading(false);
          return;
        }
        // 非メンバーまたは private グループの非メンバーには 404 が返る
        if (res.status === 404) {
          setIsNotFound(true);
          setNotesLoading(false);
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
    orgIdNum,
    groupIdNum,
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
  function getBreadcrumb(): Array<{ id: number | null; name: string }> {
    const path: Array<{ id: number | null; name: string }> = [];
    let current: number | null = currentFolderId;
    while (current !== null) {
      const folder = allFolders.find((f) => f.id === current);
      if (!folder) break;
      path.unshift({ id: folder.id, name: folder.name });
      current = folder.parent_id;
    }
    return [{ id: null, name: "ルート" }, ...path];
  }

  const breadcrumb = getBreadcrumb();
  const isFiltering = !!submittedQuery || selectedTags.length > 0;
  // グループ内のノート一覧ページのベース URL（Link href の組み立てに使う）
  const notesBase = `/organizations/${orgId}/groups/${groupId}/notes`;

  // 非メンバー・private グループ非メンバーの場合は 404 ページを表示する
  if (isNotFound) {
    notFound();
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground flex">
      {/* 左カラム: 検索・タグフィルターサイドバー（画面上端まで広がる） */}
      <FolderSidebar
        orgId={orgId}
        groupId={groupId}
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

      {/* 右カラム: ヘッダー＋メインコンテンツ */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 共通ヘッダー: ベル通知・ユーザーメニューを提供する */}
        <AppHeader showLogo={false} />
        {/* メインコンテンツ */}
        <div className="flex-1 overflow-y-auto px-6 py-10">
          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            {/* ページヘッダー: タイトル・新規作成 */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold">
                  {groupName ? `${groupName}` : "ノート一覧"}
                </h1>
              </div>
              <div className="flex gap-2">
                {/* 新規作成ポップオーバー: ノート or フォルダーを選択する */}
                <NewItemButton
                  currentFolderId={currentFolderId}
                  notesBase={notesBase}
                  onCreateFolder={() => setIsFolderModalOpen(true)}
                />
              </div>
            </div>

            {/* ブレッドクラム */}
            <FolderBreadcrumb
              breadcrumb={breadcrumb}
              onNavigate={handleNavigate}
            />

            {/* フィルター中バナー */}
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
              {currentLevelFolders.length > 0 && (
                <ul className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {currentLevelFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      orgId={orgIdNum}
                      groupId={groupIdNum}
                      onNavigate={handleNavigate}
                      onMutation={fetchAllFolders}
                    />
                  ))}
                </ul>
              )}

              {notesLoading ? (
                <p className="text-gray-500 text-base">読み込み中...</p>
              ) : notesError ? (
                <p className="text-red-500 text-sm">{notesError}</p>
              ) : notes.length === 0 && currentLevelFolders.length === 0 ? (
                <p className="text-gray-500">
                  {isFiltering
                    ? "該当するノートが見つかりませんでした。"
                    : "ノートがありません。"}
                </p>
              ) : notes.length > 0 ? (
                <ul className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {notes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      orgId={orgIdNum}
                      groupId={groupIdNum}
                      selectedTags={selectedTags}
                      onTagToggle={handleTagToggle}
                      folders={allFolders}
                      onMoved={handleNoteMoved}
                      onDeleted={handleNoteMoved}
                    />
                  ))}
                </ul>
              ) : null}
            </div>

            {/* ページネーション */}
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
      </div>

      {/* フォルダー新規作成モーダル */}
      <FolderCreateModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        orgId={orgIdNum}
        groupId={groupIdNum}
        currentFolderId={currentFolderId}
        onCreated={fetchAllFolders}
      />
    </main>
  );
}
