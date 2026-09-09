# API リファレンス

すべてのエンドポイントは `/api` プレフィックス配下（`backend/app/api/__init__.py` で `api_bp` に登録）。「認証」列の記号:

- `—` : 認証不要
- `JWT` : `@jwt_required()` のみ（ログイン済みであれば誰でも可）
- それ以外: 必要なロール・権限

ノート/フォルダーの各ルートは、実装上は `note_service.py` / `folder_service.py` を呼び出すが、URLとしては `/api/organizations/<org_id>/groups/<group_id>/...` 配下にマウントされている（Phase 3以前の個人ノート仕様だった `notes/routes.py` / `folders/routes.py` は、`notes_bp` / `folders_bp` が既に削除されimportすら失敗する壊れたデッドコードだったため削除済み）。

## 認証 (`/api/auth`)

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| POST | `/api/auth/register` | — | ユーザー登録 |
| GET | `/api/auth/verify/<token>` | — | 登録時のメール確認 |
| POST | `/api/auth/resend-verification` | — | 確認メール再送 |
| GET | `/api/auth/user/status` | — | メール確認状態の確認 |
| POST | `/api/auth/login` | — | ログイン。アクセストークン＋リフレッシュトークンを返す |
| POST | `/api/auth/refresh` | refresh JWT | アクセストークンを再発行 |
| GET | `/api/auth/me` | JWT | 現在のユーザー情報を取得。`needs_onboarding`（組織未所属なら true）を含む |
| DELETE | `/api/auth/me` | JWT | アカウント削除。組織で`owner`/`member`以外のロールを持つ、グループの`admin`である、非公開ノートのオーナーである、作成したノート/フォルダが残っている、のいずれかに該当すると409を返しブロックする |
| PATCH | `/api/auth/me/username` | JWT | ユーザー名変更 |
| POST | `/api/auth/me/password/verify` | JWT | 現在のパスワードを検証（変更前の事前確認） |
| PATCH | `/api/auth/me/password` | JWT | パスワード変更 |
| PATCH | `/api/auth/me/email` | JWT | メールアドレス変更申請（確認メール送信） |
| GET | `/api/auth/verify-email-change/<token>` | — | メールアドレス変更の確認 |
| POST | `/api/auth/forgot-password` | — | パスワードリセットメール送信 |
| GET | `/api/auth/reset-password/<token>` | — | リセットトークンの検証 |
| POST | `/api/auth/reset-password/validate-token` | — | リセットトークンの検証（JSONボディ版） |
| POST | `/api/auth/reset-password` | — | リセットトークンで新パスワードを設定 |

## 招待 (`/api/invitations`)

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | `/api/invitations/<token>` | — | トークンから招待詳細を取得 |
| POST | `/api/invitations/<token>/accept` | JWT | 招待を承諾して組織に参加。招待先メールアドレスとログインユーザーのメールアドレスが一致しない場合は403 |

## 通知 (`/api/notifications`)

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | `/api/notifications` | JWT | 未読通知一覧を取得（参加申請・申請結果・プライベートノート招待をまとめて返す。既読管理があるのはプライベートノート招待のみ） |
| PATCH | `/api/notifications/<id>/read` | JWT | プライベートノート招待通知を既読にする（他の通知タイプは対象外） |
| DELETE | `/api/notifications/rejected` | JWT | 拒否通知をまとめて削除 |

## 組織 (`/api/organizations`)

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | `/api/organizations` | JWT | 自分が所属する組織一覧 |
| POST | `/api/organizations` | JWT | 組織を作成（作成者が `owner` になる） |
| GET | `/api/organizations/<org_id>` | member | 組織詳細＋ポリシー |
| PATCH | `/api/organizations/<org_id>` | owner/sys_admin | 組織名・ポリシーの更新 |
| DELETE | `/api/organizations/<org_id>` | owner | 組織削除（グループが1つでも残っていると409） |
| POST | `/api/organizations/<org_id>/transfer-ownership` | owner | オーナー権限を別メンバーに移譲（自分は member に降格） |
| GET | `/api/organizations/<org_id>/members` | member | メンバー一覧 |
| POST | `/api/organizations/<org_id>/members` | owner/sys_admin/user_admin | メンバー追加 |
| PATCH | `/api/organizations/<org_id>/members/<uid>` | owner/sys_admin | メンバーのロール変更 |
| DELETE | `/api/organizations/<org_id>/members/<uid>` | owner/sys_admin/user_admin | メンバー削除 |
| POST | `/api/organizations/<org_id>/leave` | member | 自己脱退（ownerは事前にオーナー移譲が必要、409） |
| POST | `/api/organizations/<org_id>/invitations` | owner/sys_admin/user_admin | メール招待を送信 |

## グループ (`/api/organizations/<org_id>/groups`)

| Method | Path | 認証 | 説明 |
|--------|------|------|------|
| GET | `.../groups` | member | アクセス可能なグループ一覧 |
| POST | `.../groups` | ポリシー依存 | グループ作成（作成者が `admin` になる） |
| GET | `.../groups/<gid>` | member（非公開グループはメンバーのみ） | グループ詳細＋ポリシー |
| PATCH | `.../groups/<gid>` | グループadmin / 組織owner・sys_admin | グループ名・可視性・ポリシーの更新 |
| DELETE | `.../groups/<gid>` | グループadmin / 組織owner・sys_admin | グループ削除 |
| POST | `.../groups/<gid>/join` | 組織メンバー | 参加申請または即時参加（`join_method`次第） |
| DELETE | `.../groups/<gid>/join` | 申請中の本人 | 自分の参加申請をキャンセル |
| GET | `.../groups/<gid>/join-requests` | グループadmin / 組織owner・sys_admin | 参加申請一覧 |
| GET | `.../groups/<gid>/join-requests/count` | グループadmin / 組織owner・sys_admin | 参加申請数（バッジ表示用） |
| PATCH | `.../groups/<gid>/join-requests/<uid>` | グループadmin / 組織owner・sys_admin | 参加申請の承認/拒否 |
| GET | `.../groups/<gid>/members` | member（非公開グループはメンバーのみ） | グループメンバー一覧（`status=active`のみ）。公開グループなら組織メンバーは誰でも閲覧可 |
| POST | `.../groups/<gid>/members` | グループadmin / 組織owner・sys_admin | 組織メンバーをグループに追加 |
| PATCH | `.../groups/<gid>/members/<uid>` | グループadmin / 組織owner・sys_admin | グループメンバーのロール変更。唯一の`admin`を降格しようとすると409（`admin`への再送信は常に許可） |
| DELETE | `.../groups/<gid>/members/<uid>` | グループadmin / 組織owner・sys_admin | グループメンバー削除。対象が唯一の`admin`、または非公開ノートのオーナーだと409（ノートタイトルは返さない） |
| POST | `.../groups/<gid>/leave` | グループメンバー | 自己脱退。唯一の`admin`、または非公開ノートのオーナーだと409（自分のノートなのでタイトル込みで返す） |

## ノート・タグ (`/api/organizations/<org_id>/groups/<gid>/notes`)

すべて `org:read`（組織メンバーシップ）に加え、下表のグループレベル権限が必要。両方を満たさない場合、対象が非公開グループなら404、公開グループなら403を返す（非メンバーに非公開グループの存在を漏らさないため）。

| Method | Path | 権限 | 説明 |
|--------|------|------|------|
| GET | `.../notes/tags` | `note:read` | グループ内のタグ一覧 |
| GET | `.../notes` | `note:read` | ノート一覧（検索・タグ・フォルダー・ページネーション対応） |
| POST | `.../notes` | `note:create` | ノート作成。`is_private=true`なら作成者を`owner`として登録 |
| GET | `.../notes/<nid>` | `note:read` | ノート詳細 |
| PATCH | `.../notes/<nid>` | `note:edit`（非公開ノートは owner/editor） | ノート更新。ただし`is_private`の切替は例外で、公開→非公開は作成者のみ、非公開→公開はownerのみ（editorは403） |
| DELETE | `.../notes/<nid>` | `note:delete`（非公開ノートは owner） | ノート削除 |
| GET | `.../notes/<nid>/members` | `note:read` | 非公開ノートの共有メンバー一覧（owner限定） |
| POST | `.../notes/<nid>/members` | note owner | 共有メンバーを招待（通知を送信） |
| PATCH | `.../notes/<nid>/members/<uid>` | note owner | 共有メンバーのロール変更 |
| DELETE | `.../notes/<nid>/members/<uid>` | note owner | 共有メンバーを削除 |
| PATCH | `.../notes/<nid>/transfer-owner` | note owner | 非公開ノートのオーナーを移管（現オーナーは editor に降格） |

## フォルダー (`/api/organizations/<org_id>/groups/<gid>/folders`)

| Method | Path | 権限 | 説明 |
|--------|------|------|------|
| GET | `.../folders` | `note:read` | グループ内のフォルダー一覧 |
| POST | `.../folders` | `note:create` | フォルダー作成 |
| PATCH | `.../folders/<fid>` | `note:edit` | フォルダーのリネーム |
| DELETE | `.../folders/<fid>` | `note:delete` | フォルダー削除（子フォルダーと直下のノートもカスケード削除） |

## 実装参照

- 組織/グループ/参加申請ルート: `backend/app/api/organizations/routes.py`
- ノート・非公開ノート共有ルート: `backend/app/api/organizations/note_routes.py`
- フォルダールート: `backend/app/api/organizations/folder_routes.py`
- 組織招待ルート: `backend/app/api/organizations/invitation_routes.py`
- サービス層: `organization_service.py` / `group_service.py` / `invitation_service.py`（`backend/app/api/organizations/`配下）
