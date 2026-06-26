/** ISO 日時文字列を "2026年6月25日" 形式にフォーマットする */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** ISO 日時文字列を "6/25 14:30" 形式にフォーマットする（通知タイムスタンプ用） */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
