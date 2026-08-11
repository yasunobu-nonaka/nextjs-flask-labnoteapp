"use client";

import Modal from "@/components/common/Modal";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** キーワード検索: 入力中の文字列 */
  query: string;
  onQueryChange: (q: string) => void;
  /** 検索ボタン押下時のハンドラ（キーワードを確定して絞り込みを実行する） */
  onSearch: () => void;
  /** 選択中のタグ一覧 */
  selectedTags: string[];
  /** 選択肢として表示するタグ一覧 */
  availableTags: string[];
  onTagToggle: (tag: string) => void;
  /** 選択中の著者ID一覧 */
  selectedAuthorIds: number[];
  /** 選択肢として表示する著者（グループメンバー）一覧 */
  availableAuthors: { id: number; username: string }[];
  onAuthorAdd: (authorId: number) => void;
  onAuthorRemove: (authorId: number) => void;
};

/**
 * NoteSearchModal コンポーネント
 * キーワード検索・著者フィルター・タグフィルターをまとめて設定するモーダル。
 * タグのチェック・著者の追加/除外は選択した時点で即座に一覧へ反映されるが、
 * キーワードだけは「検索」ボタン押下時に onSearch でまとめて確定する
 * （キー入力のたびに再取得が走らないようにするため）。
 */
export default function NoteSearchModal({
  isOpen,
  onClose,
  query,
  onQueryChange,
  onSearch,
  selectedTags,
  availableTags,
  onTagToggle,
  selectedAuthorIds,
  availableAuthors,
  onAuthorAdd,
  onAuthorRemove,
}: Props) {
  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSearch();
    onClose();
  }

  return (
    <Modal title="ノート検索 & 絞り込み" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* キーワード検索 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold">キーワード</label>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="タイトルで検索..."
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
          />
        </div>

        {/* 著者フィルター: ドロップダウンで選択したメンバーをチップとして下に追加していく */}
        {availableAuthors.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold">著者で絞り込み</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onAuthorAdd(Number(e.target.value));
                }
              }}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground text-base"
            >
              <option value="">著者を選択...</option>
              {availableAuthors
                .filter((author) => !selectedAuthorIds.includes(author.id))
                .map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.username}
                  </option>
                ))}
            </select>
            {selectedAuthorIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedAuthorIds.map((id) => {
                  const author = availableAuthors.find((a) => a.id === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onAuthorRemove(id)}
                      title="クリックで除外"
                      className="px-2 py-0.5 rounded-full bg-foreground text-background text-sm"
                    >
                      {author?.username ?? id} ×
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* タグフィルター: チェックボックス一覧 */}
        {availableTags.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold">タグで絞り込み</label>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
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

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-base rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity"
          >
            検索
          </button>
        </div>
      </form>
    </Modal>
  );
}
