"use client";

type Props = {
  /** キーワード検索: 入力中の文字列 */
  query: string;
  onQueryChange: (q: string) => void;
  /** 検索フォームの送信ハンドラ */
  onSearch: () => void;
  /** 選択中のタグ一覧 */
  selectedTags: string[];
  /** 選択肢として表示するタグ一覧 */
  availableTags: string[];
  onTagToggle: (tag: string) => void;
};

/**
 * FolderSidebar コンポーネント
 * キーワード検索フォームとタグフィルターを表示する左サイドバー。
 * フォルダーナビゲーションはメインコンテンツ側の FolderCard / ブレッドクラムで行う。
 */
export default function FolderSidebar({
  query,
  onQueryChange,
  onSearch,
  selectedTags,
  availableTags,
  onTagToggle,
}: Props) {
  return (
    <aside className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-700 pt-10 pb-6 px-3 flex flex-col gap-4">
      {/* キーワード検索フォーム */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
        className="flex flex-col gap-1.5"
      >
        <span className="text-base font-semibold text-gray-400 uppercase tracking-wider px-2">
          ノート検索
        </span>
        <div className="flex gap-1">
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="タイトルで検索..."
            className="flex-1 min-w-0 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
          />
          <button
            type="submit"
            className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-base hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
          >
            検索
          </button>
        </div>
      </form>

      {/* タグフィルター: チェックボックス一覧 */}
      {availableTags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-base font-semibold text-gray-400 uppercase tracking-wider px-2">
            タグで絞り込み
          </span>
          <div className="flex flex-col gap-1 px-2">
            {availableTags.map((tag) => (
              <label
                key={tag}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => onTagToggle(tag)}
                  className="rounded border-gray-300 dark:border-gray-700"
                />
                <span className="text-base truncate">{tag}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
