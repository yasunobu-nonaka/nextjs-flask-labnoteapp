# テスト内容一覧

各テストファイルが何をカバーしているかの一覧。実行コマンドは [development.md](./development.md) を参照。

このファイルは手動保守のため、テストクラス（フロントエンドはテストケース）を追加・変更した場合はここも更新すること。

## バックエンド（`backend/tests/`）

pytest + SQLite（インメモリ）。9ファイル、テストクラス単位で内容をまとめている。

### test_auth.py

| クラス | 内容 |
|--------|------|
| `TestUserRegistration` | 登録成功、ユーザー名/メール重複、必須項目欠如、ユーザー名・メール・パスワードの文字数/形式バリデーション |
| `TestEmailVerification` | メール確認の成功、確認済みの場合、期限切れ/無効トークン、存在しないユーザー |
| `TestResendVerification` | 確認メール再送信の成功、メール未指定、存在しないユーザー、確認済みの場合 |
| `TestTokenGeneration` | トークンの生成・検証（正常/期限切れ/無効） |
| `TestUserLogin` | ログイン成功、識別子/パスワード未指定、パスワード誤り、存在しないユーザー |
| `TestTokenRefresh` | アクセストークン再発行、再発行トークンでの保護ルート利用、アクセストークンでのリフレッシュ拒否、トークンなし |
| `TestUserStatus` | メール確認状態の取得、メール未指定、存在しないユーザー |
| `TestPasswordReset` | リセットメール送信、存在しない/未指定メール、リセット実行、期限切れ/無効/弱いパスワード/項目欠如、トークン検証系エンドポイント |
| `TestPasswordResetIntegration` | 一連のリセットフロー、新規リクエストによる旧トークン無効化、同一トークンの再利用防止 |
| `TestGetMe` | 現在のユーザー情報取得、トークンなしで401、`needs_onboarding`の真偽切り替え |
| `TestUpdateUsername` | ユーザー名変更成功、同名指定、重複、短すぎる、トークンなし |
| `TestUpdateEmail` | メール変更申請の成功、同一メール、重複、トークンなし |
| `TestVerifyEmailChange` | 変更確認の成功、無効トークン、申請なし、既に使われているメール |
| `TestVerifyPassword` | 現在パスワードの検証（正解/不正解/短すぎる/トークンなし） |
| `TestUpdatePassword` | パスワード変更成功、現パスワード誤り、確認不一致、短すぎる、トークンなし |
| `TestDeleteMe` | 削除成功、トークンなし、組織ロール保持/グループadmin/非公開ノートオーナー/未削除ノート・フォルダーによるブロック、削除時のメンバーシップ自動削除 |

### test_organizations.py

| クラス | 内容 |
|--------|------|
| `TestOrganizationCreation` | 作成成功、名前未指定/空/文字数超過、未認証 |
| `TestOrganizationRead` | 一覧（空/複数）、詳細取得、存在しない組織、非メンバー |
| `TestOrganizationUpdate` | 名前/ポリシー更新、memberによる更新禁止 |
| `TestOrganizationMembers` | メンバー追加、重複追加、一覧、ロール変更、削除、owner削除の禁止 |
| `TestOrganizationLeave` | メンバーの離脱、owner離脱の禁止、非メンバーの離脱は404 |
| `TestNonMemberAccessReturns404` | 更新/メンバー追加/ロール変更/メンバー削除が非メンバーには404 |
| `TestOrganizationDeletion` | 削除成功、グループが残っている場合のブロック、非owner禁止、非メンバー404 |
| `TestOrganizationOwnershipTransfer` | 移譲成功、自分自身への移譲禁止、非メンバーへの移譲禁止、非owner禁止、非メンバー404 |

### test_groups.py

| クラス | 内容 |
|--------|------|
| `TestGroupCreation` | 作成成功（公開/非公開）、名前未指定、組織アクセスなし、ポリシーによる作成/非公開制限 |
| `TestGroupRead` | 一覧、非公開グループの非メンバーからの隠蔽、詳細取得、非公開グループへの非メンバーアクセス拒否 |
| `TestGroupUpdate` | 名前/ポリシー更新、viewerによる更新禁止 |
| `TestGroupDeletion` | 削除成功 |
| `TestGroupMembers` | メンバー追加、組織非メンバーの追加禁止、一覧、ロール変更、唯一のadmin降格禁止（再指定は許可）、他adminがいる場合の降格許可、メンバー削除 |
| `TestGroupLeave` | メンバー離脱、唯一のadmin離脱禁止、他adminがいる場合の離脱許可、唯一admin削除禁止、他adminがいる場合の削除許可、非組織メンバーの離脱は404 |
| `TestNonMemberGroupAccessReturns404` | 更新/削除/メンバー追加/ロール変更/メンバー削除/非公開グループ更新が非組織・非グループメンバーには404 |

### test_join_requests.py

| クラス | 内容 |
|--------|------|
| `TestJoinGroup` | open/request/invite_onlyそれぞれの参加挙動、既にメンバー/申請中の場合、組織非メンバー、未認証 |
| `TestListJoinRequests` | グループadminによる一覧、非adminによる一覧禁止、申請なしの場合 |
| `TestCountJoinRequests` | 申請件数取得（あり/なし）、非adminによる禁止 |
| `TestApproveRejectJoinRequest` | 承認、拒否、対象なし、非adminによる操作禁止、不正なaction |
| `TestCancelJoinRequest` | 申請中の取消、申請中でない場合、非組織メンバー、未認証 |
| `TestRejectAndReapply` | 拒否後の再申請、承認時の`approved_at`記録 |

### test_notes.py

| クラス | 内容 |
|--------|------|
| `TestNoteCreation` | 作成成功（タグなし/フォルダー指定）、タイトル/本文未指定、タイトル空/文字数超過、タグにnullを含む、トークンなし、非メンバー禁止 |
| `TestNoteIndex` | 一覧、トークンなし、キーワード/タグ/著者（単一・複数）/フォルダー（指定・null）検索、ページネーション、非メンバー禁止 |
| `TestNoteDetail` | 詳細取得、トークンなし、存在しないノート、非メンバー禁止 |
| `TestNoteEdit` | 編集成功、トークンなし、存在しないノート、非メンバー禁止 |
| `TestNoteDelete` | 削除成功、トークンなし、存在しないノート、非メンバー禁止 |
| `TestTagsIndex` | タグ一覧、重複排除、トークンなし、非メンバー禁止 |
| `TestPrivateNotes` | 非公開ノート作成（オーナー登録）、他グループメンバーへの非表示、非メンバーへの404、共有後の閲覧可否、viewer編集禁止、非オーナー削除禁止、オーナーのみメンバー追加可、ポリシーによる作成禁止、公開⇄非公開変換の権限（作成者/オーナーのみ）、共有editorの編集可否、オーナー移管とその制限、オーナーノート保持メンバーの削除/離脱ブロックと移管後の解除 |

### test_folders.py

| クラス | 内容 |
|--------|------|
| `TestFolderCreation` | 作成成功（親指定含む）、名前未指定/空/文字数超過、存在しない親、トークンなし、非メンバー禁止 |
| `TestFolderIndex` | 一覧、トークンなし、非メンバー禁止 |
| `TestFolderRename` | リネーム成功、トークンなし、名前未指定/空/文字数超過、存在しないフォルダー、非メンバー禁止 |
| `TestFolderDelete` | 削除成功、子フォルダーへのカスケード、トークンなし、存在しないフォルダー、非メンバー禁止 |

### test_invitations.py

| クラス | 内容 |
|--------|------|
| `TestSendInvitation` | 送信成功、デフォルトロール、無効なメール/ロール、未認証、権限不足、pending中の重複送信は既存を再利用 |
| `TestGetInvitation` | 取得成功、無効トークン、認証不要 |
| `TestAcceptInvitation` | 承諾成功、宛先メール不一致、無効トークン、承諾済み、未認証 |

### test_notifications.py

| クラス | 内容 |
|--------|------|
| `TestGetNotifications` | 申請なし、adminへの申請通知、複数グループの集約、非adminには空、承認済みは含まれない、未認証 |
| `TestMemberResultNotifications` | 承認通知、拒否通知、直接追加時は承認通知なし、拒否通知の削除、未認証、レスポンス形式 |

### test_rbac.py

| クラス | 内容 |
|--------|------|
| `TestRbacSeedData` | 組織/グループの権限・ロールが全てシードされているか |
| `TestOrganizationRolePermissions` | ownerの全権限、sys_adminの削除不可、user_adminの編集不可、memberの権限範囲 |
| `TestGroupRolePermissions` | adminの全権限、editorの管理不可、editorのノート操作可、viewerの閲覧のみ |
| `TestPermissionCheckViaApi` | owner編集可能、member編集不可（403）、viewerのグループ更新不可（403） |

## フロントエンド

Jest + React Testing Library + MSW。10ファイル。テストクラスに相当する概念がないため、テストケース（`it`）単位でまとめている。

### components/common/RadioGroup.test.tsx

| ケース |
|--------|
| 各選択肢がラベル付きのラジオボタンとして表示される |
| `value`プロパティに一致する選択肢だけが`checked`になる |
| 選択肢をクリックすると、その値で`onChange`が呼ばれる |
| `description`を持つ選択肢では説明文も表示される |

### components/folder/FolderCreateModal.test.tsx

| ケース |
|--------|
| フォルダー名を入力して作成すると、`onClose`と`onCreated`が呼ばれる |
| フォルダー名が空のときは送信されない（リクエストが飛ばない） |

### components/folder/FolderSidebar.test.tsx

| ケース |
|--------|
| `join_method`が openのグループは、参加すると即座にそのグループのノート一覧へ遷移する |
| `join_method`が requestのグループは、参加申請すると「参加申請済み」表示に変わる |
| 申請済みの状態で×を押すとキャンセルされ、「参加申請」ボタンに戻る |
| `join_method`が invite_onlyのグループは、ボタンの代わりに「招待制」バッジを表示する |
| 参加申請が失敗した場合はエラーメッセージを表示し、ボタンは押せる状態に戻る |

### components/note/NoteSearchModal.test.tsx

| ケース |
|--------|
| `isOpen`が falseのときは何も描画しない |
| キーワード入力欄に入力すると`onQueryChange`が呼ばれる |
| 「検索」ボタンを押すと`onSearch`と`onClose`の両方が呼ばれる |
| 「キャンセル」ボタンを押すと`onClose`だけが呼ばれる |
| タグをクリックすると`onTagToggle`がそのタグ名で呼ばれる |
| `selectedTags`に含まれるタグはチェック済みで表示される |
| 著者をドロップダウンで選択すると`onAuthorAdd`が呼ばれる |
| 選択済み著者のチップをクリックすると`onAuthorRemove`が呼ばれる |
| `availableTags`が空のときはタグフィルター欄自体を表示しない |
| `availableAuthors`が空のときは著者フィルター欄自体を表示しない |

### components/org/OrgCreateModal.test.tsx

| ケース |
|--------|
| 組織名が空のときは「作成」ボタンが無効化されている |
| 組織名を入力して作成すると、正しい内容でPOSTし`onCreated`が呼ばれる |
| 送信中は「作成中...」と表示され、ボタンが無効化される |
| サーバーがエラーを返すとメッセージを表示し、`onCreated`は呼ばれない |
| ネットワークエラー時は接続失敗のメッセージを表示する |
| ポリシーのラジオボタンを変更すると、その内容がリクエストに反映される |

### lib/api.test.ts（`authFetch`）

| ケース |
|--------|
| 200が返るときはリフレッシュを試みず、そのレスポンスをそのまま返す |
| 401 & refresh_tokenがない場合は、リフレッシュを試みずログアウト処理をする |
| 401 & リフレッシュAPIが失敗する場合は、ログアウト処理をする |
| 401 & リフレッシュ成功時は、新トークンで元のリクエストをリトライして成功レスポンスを返す |

### lib/folders.test.ts（`buildFolderOptions`）

| ケース |
|--------|
| フラットな配列を、親子関係に沿った階層付きラベルへ変換する |
| フォルダーが1件もない場合は空配列を返す |
| ルート直下のフォルダーにはプレフィックスが付かない |
| 子フォルダーは親の直後（深さ優先）に並ぶ |

### lib/hooks/useTagInput.test.ts

| ケース |
|--------|
| タグが追加される |
| 空文字は追加されない（`setTags`が呼ばれない） |
| 21文字のタグでは`tagError`にメッセージがセットされる |
| 既にタグが10個ある状態では追加されない |
| 既に同じタグがある場合は追加されない |
| `removeTag`で指定したタグだけが除外される |

### lib/hooks/useUnsavedChangesGuard.test.ts

| ケース |
|--------|
| `confirmBeforeLeave`: `isDirty`が falseなら確認ダイアログを出さず trueを返す |
| `confirmBeforeLeave`: `isDirty`が trueなら`window.confirm`の結果をそのまま返す |
| `beforeunload`: `isDirty`が trueなら`beforeunload`をキャンセルする |
| `beforeunload`: `isDirty`が falseなら`beforeunload`をキャンセルしない |
| `beforeunload`: リスナーは1回しか登録されないが、再レンダー後の最新の`isDirty`を参照する |

### lib/schemas/noteSchema.test.ts

| ケース |
|--------|
| 正しい入力は検証を通過する |
| タイトルが空文字だとエラーになる |
| タイトルが200文字を超えるとエラーになる |
| タイトルがちょうど200文字なら通過する |
| 本文が空文字だとエラーになる |
| タグが20文字を超えるとエラーになる |
| タグが11個以上あるとエラーになる |
| タグが空配列でも通過する |
| `is_private`が booleanでないとエラーになる |
