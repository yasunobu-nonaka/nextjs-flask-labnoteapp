/**
 * 組織ロール（owner / sys_admin / user_admin / member）の表示ラベル。
 * 組織メンバー管理画面など、組織スコープのロールを表示する箇所で使う。
 */
export const ORG_ROLE_LABELS: Record<string, string> = {
  owner: "オーナー",
  sys_admin: "システム管理者",
  user_admin: "ユーザー管理者",
  member: "メンバー",
};

/**
 * グループロール（admin / editor / viewer）の表示ラベル。
 * グループメンバー管理画面・グループ一覧モーダルなど、グループスコープのロールを表示する箇所で使う。
 */
export const GROUP_ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

/**
 * グループメンバーに割り当て可能なロール一覧（権限が強い順）。
 * ロール選択 `<select>` や RadioGroup で選択肢として使う。
 */
export const ASSIGNABLE_GROUP_ROLES = ["admin", "editor", "viewer"] as const;

/**
 * グループへの参加方式の選択肢。
 * label は UI 上の短い表示名、description はポリシー設定画面での補足説明。
 * description を表示しないラジオグループでも同じ配列を渡してよい（無視される）。
 */
export const JOIN_METHOD_OPTIONS: {
  value: string;
  label: string;
  description: string;
}[] = [
  {
    value: "invite_only",
    label: "招待のみ",
    description:
      "管理者が招待したユーザーのみ参加できます。外部からの参加申請は受け付けません。",
  },
  {
    value: "request",
    label: "招待または申請",
    description:
      "組織メンバーが参加を申請でき、管理者が承認または拒否します。管理者による直接招待も引き続き可能です。",
  },
  {
    value: "open",
    label: "オープン",
    description:
      "組織メンバーであれば誰でも自由に参加できます。管理者による直接招待も引き続き可能です。",
  },
];

/**
 * グループ作成権限の選択肢（制限が強い順）。
 * 組織ポリシー設定画面・組織作成フォームで使う。
 */
export const WHO_CAN_CREATE_OPTIONS = [
  { value: "sys_admin_only", label: "システム管理者のみ" },
  { value: "user_admin", label: "ユーザー管理者以上" },
  { value: "member", label: "メンバー以上" },
  { value: "all", label: "全員" },
];
