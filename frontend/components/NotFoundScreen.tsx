import Link from "next/link";

type Props = {
  /** バックリンクの表示テキスト。省略時は「組織一覧に戻る」 */
  backLabel?: string;
  /** バックリンクの遷移先 URL。省略時は /organizations */
  backHref?: string;
};

/**
 * 非メンバーアクセスなどで API が 404 を返したときに表示する全画面エラーページ。
 * ページ存在の有無は伝えず「存在しないか、アクセス権がない」という中立的なメッセージにする。
 */
export default function NotFoundScreen({
  backLabel = "組織一覧に戻る",
  backHref = "/organizations",
}: Props) {
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
          href={backHref}
          className="px-5 py-2.5 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity"
        >
          {backLabel}
        </Link>
      </div>
    </main>
  );
}
