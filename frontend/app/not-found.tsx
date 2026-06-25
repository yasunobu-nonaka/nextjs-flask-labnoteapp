import Link from "next/link";

/**
 * 存在しないルートへのアクセスや notFound() 呼び出し時に表示される 404 ページ。
 * ページやリソースの存在有無を漏らさないよう、中立的なメッセージを表示する。
 */
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-6 text-center px-6">
        {/* 大きな 404 数字 */}
        <p className="text-8xl font-bold text-gray-200 dark:text-gray-700 select-none">
          404
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">ページが見つかりません</h1>
          <p className="text-base text-gray-500 dark:text-gray-400">
            このページは存在しないか、アクセスする権限がありません。
          </p>
        </div>
        <Link
          href="/organizations"
          className="px-5 py-2.5 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
        >
          組織一覧に戻る
        </Link>
      </div>
    </main>
  );
}
