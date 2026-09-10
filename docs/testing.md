# テスト内容一覧

各テストファイルが何をカバーしているかの一覧。実行コマンドは [development.md](./development.md) を参照。

このファイルは手動保守のため、テストファイルを追加・改名した場合はここも更新すること。個々のテストケース名までは追わず、ファイル単位の概要にとどめている。

## バックエンド（`backend/tests/`）

pytest + SQLite（インメモリ）。9ファイル。

### test_auth.py

ユーザー登録（バリデーション・重複チェック）、メール確認（送信・再送信・トークン検証）、ログイン・トークンリフレッシュ、認証状態確認、パスワードリセット（メール送信〜実行）、プロフィール取得（`GET /me`）、ユーザー名変更、メールアドレス変更（申請・確認）、パスワード検証・変更、アカウント削除（オーナー/管理者/非公開ノートオーナーなど各種ブロック条件を含む）。

### test_organizations.py

組織の作成・一覧・詳細取得・更新（名前・ポリシー）、メンバー管理（追加・一覧・ロール変更・削除、ownerは削除不可）、組織離脱（ownerは離脱不可）、非メンバーへの404ハードニング。

### test_groups.py

グループの作成（公開・非公開、組織ポリシーによる作成/非公開の制限）、一覧・詳細取得（非公開グループを非メンバーから隠蔽）、更新（名前・ポリシー、権限チェック）、削除、メンバー管理（追加・一覧・ロール変更、唯一のadminの降格/削除防止）、グループ離脱。

### test_join_requests.py

参加方式（open / request / invite_only）ごとの参加挙動、参加申請一覧・件数取得、申請の承認・拒否、申請のキャンセル、拒否後の再申請。

### test_notes.py

ノートの作成・一覧（キーワード検索・タグ/著者/フォルダーフィルタ・ページネーション）・詳細・編集・削除、グループ内タグ一覧、非公開ノート（作成時のオーナー登録、非メンバーへの非表示、共有後の閲覧、editor/viewerの編集・削除権限）。

### test_folders.py

フォルダーの作成（親子関係を含む）・一覧・リネーム・削除（子フォルダーへのカスケード削除）、非メンバーによるアクセス拒否。

### test_invitations.py

組織へのメール招待の送信（権限チェック・pending中の重複送信は既存招待を再利用）、トークンによる招待詳細取得、招待の承諾（宛先メールとの一致チェック・二重承諾の防止）。

### test_notifications.py

参加申請の管理者向け通知一覧（複数グループ管理時の集約含む）、申請結果（承認・拒否）の通知、拒否通知のクリア（既読化ではなく削除）。

### test_rbac.py

RBACシードデータの検証（権限・ロールが全て投入されているか）、組織ロール（owner/sys_admin/user_admin/member）とグループロール（admin/editor/viewer）それぞれが持つ権限の検証、API経由での権限チェック（実際に403になるか）。

## フロントエンド

Jest + React Testing Library + MSW。10ファイル。

### components/common/RadioGroup.test.tsx

選択肢のラベル付きレンダリング、`value`に一致する選択肢のchecked状態、クリック時の`onChange`呼び出し、説明文（description）の表示。

### components/folder/FolderCreateModal.test.tsx

フォルダー名を入力して作成した際の`onClose`/`onCreated`呼び出し、名前が空の場合に送信されないこと。

### components/folder/FolderSidebar.test.tsx

未所属グループへの参加フロー（`join_method`が open/request/invite_only それぞれの挙動）、参加申請のキャンセル、参加失敗時のエラー表示とボタンの復帰。

### components/note/NoteSearchModal.test.tsx

キーワード入力、検索/キャンセルボタンの`onSearch`/`onClose`呼び出し、タグの選択・選択状態表示、著者の追加・削除、利用可能なタグ/著者が空の場合にフィルター欄自体を非表示にすること。

### components/org/OrgCreateModal.test.tsx

組織名が空の場合のボタン無効化、作成成功時のPOST内容と`onCreated`呼び出し、送信中表示、サーバーエラー/ネットワークエラー時のメッセージ表示、ポリシー変更の反映。

### lib/api.test.ts（`authFetch`）

200レスポンス時はそのまま返す、401でリフレッシュトークンがない場合はログアウト処理、401でリフレッシュAPIが失敗した場合もログアウト処理、401でリフレッシュ成功時は新トークンで元のリクエストをリトライする。

### lib/folders.test.ts（`buildFolderOptions`）

フラットなフォルダー配列を親子関係に沿った階層ラベルへ変換、空配列時の挙動、ルート直下フォルダーのプレフィックス、子フォルダーの深さ優先の並び順。

### lib/hooks/useTagInput.test.ts

タグの追加、空文字・21文字超過・10個超過・重複タグの追加拒否、指定タグの削除。

### lib/hooks/useUnsavedChangesGuard.test.ts

`confirmBeforeLeave`の確認ダイアログ制御（`isDirty`に応じて`window.confirm`を呼ぶか）、`beforeunload`のキャンセル制御、リスナーが1回しか登録されず再レンダー後も最新の`isDirty`を参照すること。

### lib/schemas/noteSchema.test.ts

タイトル（空文字・200文字境界）・本文（空文字）・タグ（20文字超過・11個以上・空配列）・`is_private`の型チェックなど、Zodスキーマのバリデーションルール。
