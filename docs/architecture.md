# アーキテクチャ

## システム構成

`compose.yaml` で3つの Docker サービスを定義している。

| サービス | 技術 | ポート |
|---------|------|--------|
| frontend | Next.js 16 / React 19 | 3000 |
| backend | Flask | 8000 → コンテナ内 5000 |
| db | PostgreSQL 16 | 5432 |

## バックエンド

エントリーポイントは `backend/app/__init__.py` の `create_app()`。拡張機能（DB, JWT, Mail, CORS など）を初期化し、`api_bp`（プレフィックス `/api`）を登録する。

### ディレクトリ構造

```
app/
  api/
    __init__.py           # api_bp、サブブループリントの登録
    auth/                 # /api/auth — 登録、ログイン、メール確認、リフレッシュ、
                          #             プロフィール取得/更新/削除、パスワードリセット、
                          #             メール変更、ユーザー名変更、アカウント削除
    invitations/           # /api/invitations — トークンベースの招待受諾（GETはJWT不要）
    notifications/         # /api/notifications — アプリ内通知（参加申請の承認/却下）
    organizations/         # /api/organizations — 組織/グループCRUD + ノート/フォルダールート
      __init__.py          # organizations_bp の定義。各サブパッケージの routes.py を import して登録
      permissions.py       # 組織/グループの権限チェック共通ヘルパー（check_org_permission 等）。
                            # organization/group/note/folder の各リソースから横断的に参照される
      organization/        # 組織CRUD・組織メンバー管理（routes.py + service.py）
      group/                # グループCRUD・グループメンバー管理・参加申請（routes.py + service.py）
      note/                 # /api/organizations/<org_id>/groups/<group_id>/notes（routes.py + service.py + tag_service.py）
      folder/               # /api/organizations/<org_id>/groups/<group_id>/folders（routes.py + service.py）
      invitation/           # /api/organizations/<org_id>/invitations — メール招待送信（routes.py + service.py）
  model/                   # SQLAlchemy 2.0 の Mapped / mapped_column スタイル
  schema/                  # Marshmallow スキーマ（バリデーション + シリアライズ）
  extensions/              # db, migrate, jwt, mail, cors — それぞれ独立ファイル
  services/
    mail_service.py        # トランザクションメール送信（確認、招待、パスワードリセット等）
  config.py                # DevelopmentConfig / TestingConfig / ProductionConfig
```

### リクエストフロー

`route → Marshmallow schema.load() でバリデーション → *_service.py の関数 → Marshmallow schema.dump() → JSONレスポンス`

### 認証

Flask-JWT-Extended を使用。グループ配下のノート/フォルダールートはすべて `@jwt_required()` に加え、`check_org_permission()` / `check_group_permission()` によるRBAC権限チェックを行う。`current_user` は `create_app` 内の `user_lookup_callback` で解決される。

権限モデルの詳細は [domain-model.md](./domain-model.md) を参照。

### バックエンドテスト

`pytest` を使用。`TestingConfig` によりインメモリ SQLite に接続するため、Docker の DB を起動しなくてもテストできる。`conftest.py` が `.env.development` を読み込み、`db.create_all()` 後に `seed_rbac()` でRBACのシードデータを投入する。

## フロントエンド

Next.js 16 App Router。`frontend/app/` 配下のページはデフォルトで Server Component。インタラクティブなページは先頭に `"use client"` を付与する。

### ディレクトリ構造（抜粋）

```
app/
  page.tsx                          # ルート。/organizations にリダイレクト
  login/, register/, forgot-password/, reset-password/[token]/
  verify-email/[token]/, verify-email-change/[token]/
  invitations/[token]/              # メール招待の受諾リンク
  onboarding/                       # 新規セルフ登録ユーザー向けセットアップウィザード
  settings/                         # プロフィール・セキュリティ設定
  organizations/
    page.tsx                        # 最終訪問組織へ自動リダイレクト or 組織一覧
    [orgId]/
      admin/                        # 組織管理（ポリシー、グループ一覧、メンバー管理）
      groups/[groupId]/
        admin/                      # グループ管理（ポリシー、メンバー、参加申請）
        notes/                      # ノート一覧・作成・詳細・編集
components/
  common/      # Modal, ConfirmModal, RadioGroup など汎用コンポーネント
  layout/      # AppHeader, HomeSidebar
  org/         # OrgCreateModal, OrgSwitchModal
  group/       # CreateGroupWizard, GroupCreateModal
  onboarding/  # OnboardingWizard
  folder/      # FolderSidebar, FolderCard, FolderBreadcrumb, FolderCreateModal
  note/        # NoteCard, NoteForm, NoteShareModal, MarkdownEditor, NewItemButton, NoteSearchModal
lib/
  api.ts                # authFetch — JWT付きfetchラッパー
  folders.ts, types.ts, constants.ts, utils.ts
  schemas/noteSchema.ts # Zod スキーマ（ノート作成/編集フォーム共通）
  hooks/                # useTagInput, useUnsavedChangesGuard
```

より詳細なコンポーネント単位の責務・設計判断（サイドバーの折りたたみ動作、モーダルのportal実装、未保存変更ガードの仕組みなど）は `CLAUDE.md` を参照。

### 主要な設計方針

- **API呼び出し**: 必ず `lib/api.ts` の `authFetch(path, init?)` を使う。`NEXT_PUBLIC_API_URL` を前置し、`localStorage` のJWTトークンをBearerヘッダーに付与する。
- **フォーム**: `NoteForm` が `useForm<NoteFormValues>` + `zodResolver(noteSchema)` を保持し、`defaultValues` を props で受け取る。
- **モーダル**: `Modal` / `ConfirmModal` は `createPortal` で `document.body` に描画する（ノートカードのスタッキングコンテキストによる重なり順の問題を回避するため）。
- **未保存変更ガード**: `useUnsavedChangesGuard(isDirty)` が `beforeunload` イベントとアプリ内ナビゲーションガードの両方を提供する。

### フロントエンドテスト

Jest + React Testing Library + MSW（APIモック）を使用。コンポーネント単位・カスタムフック単位でテストを書き、API呼び出しを伴うコンポーネントは MSW でエンドポイントをモックする（`npm run test`）。テストファイルは対象コンポーネントと同じディレクトリに `*.test.tsx` として置く。
