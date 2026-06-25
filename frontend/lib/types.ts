/**
 * 組織のポリシー設定。
 * 組織作成フォーム・組織ポリシー管理ページ・FolderSidebar のグループ作成権限判定で使う。
 */
export type OrgPolicy = {
  allow_private_groups: boolean;
  allow_private_notes: boolean;
  who_can_create_groups: string;
  default_join_method: string;
};

/**
 * 組織メンバーの基本情報。
 * グループ作成ウィザード（メンバー追加 Step）・グループメンバー管理ページで使う。
 */
export type OrgMember = {
  user_id: number;
  username: string;
  email: string;
  role: string;
};

/**
 * グループへの追加が予定されているメンバー（確定前の中間状態）。
 * グループ作成ウィザードと、グループメンバー管理ページのメンバー追加モーダルで使う。
 */
export type PendingMember = {
  userId: number;
  username: string;
  email: string;
  role: string;
};
