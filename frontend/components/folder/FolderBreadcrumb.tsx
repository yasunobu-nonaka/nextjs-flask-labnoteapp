"use client";

/**
 * FolderBreadcrumb コンポーネント
 * ルートから現在フォルダーまでのパスをパンくずリストとして表示する。
 * 末尾以外の要素はボタンになっており、クリックで任意の階層へジャンプできる。
 */
export default function FolderBreadcrumb({
  breadcrumb,
  onNavigate,
}: {
  breadcrumb: Array<{ id: number | null; name: string }>;
  onNavigate: (id: number | null) => void;
}) {
  return (
    <nav
      aria-label="フォルダーの階層"
      className="flex items-center gap-1 text-base text-gray-500 flex-wrap"
    >
      {breadcrumb.map((item, index) => {
        const isLast = index === breadcrumb.length - 1;
        return (
          <span key={item.id ?? "root"} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-gray-400 select-none">›</span>
            )}
            {isLast ? (
              <span className="text-foreground font-medium">{item.name}</span>
            ) : (
              <button
                onClick={() => onNavigate(item.id)}
                className="hover:underline hover:text-foreground transition-colors"
              >
                {item.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
