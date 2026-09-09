# ロードマップ

個人用メモツールから、組織／グループ単位で共有するノートプラットフォームへ拡張する「Organization & Group Redesign」を Phase 1〜7 に分けて進めている。Phase 1〜6 は完了、**Phase 7 は一部完了**（オンボーディングウィザードのみ実装済み）。

## フェーズ計画

| Phase | 状態 | PR | 内容 |
|-------|------|-----|------|
| 1 | ✅ 完了 | #19 | Organization・Groupモデル、メンバーシップ、基本API |
| 2 | ✅ 完了 | #19 | フルRBAC（Permission / OrganizationRole / RoleLocal モデル） |
| 3 | ✅ 完了 | #19 | Note / Tag / Folder の所有権をUser→Groupへ移行 |
| 4 | ✅ 完了 | #19 #20 #26 | フロントエンド — 組織/グループナビゲーション、グループスコープのノートページ、グループ作成ウィザード、組織/グループ一覧ページ |
| 5 | ✅ 完了 | #19 #21 #22 #24 | アクセス制御・共有 — メール招待、グループ参加申請・承認、非メンバーへの404ハードニング、非公開ノート |
| 6 | ✅ 完了 | #8 #25 #27 | ユーザーアカウント管理 — パスワードリセット、ユーザー設定（ユーザー名/メール変更、アカウント削除） |
| 7 | 🔶 一部完了 | `9e63418` | オンボーディングセットアップウィザード — 完了。監査ログ、高度な組織/グループポリシーは未着手 |

## ドメイン概念（要約）

- **Organization**: 最大の共有単位。ノートは組織の外には公開されない
- **Group**: 組織の下位単位。ノートは基本的にグループ内で作成される
- **OrganizationPolicy**: 組織ごとの設定（1:1）。誰がグループを作成できるか、デフォルトの参加方式など
- **GroupPolicy**: グループごとの設定（1:1）。ノートを組織へ公開するか、参加方式など
- グループの可視性はデフォルトで組織内に公開。ノートはデフォルトでグループ内に公開

詳細は [domain-model.md](./domain-model.md) を参照。

## Phase 7: オンボーディングウィザード（完了）

自己登録したユーザー（メール招待経由ではない）は `GET /api/auth/me` が `needs_onboarding: true`（組織所属ゼロ）を返し、`/organizations` から `/onboarding`（`frontend/app/onboarding/page.tsx`）へリダイレクトされる。招待経由で参加したユーザーはすでに組織に所属しているため `needs_onboarding` は `false` となり、このリダイレクトはスキップされる。

`OnboardingWizard`（`frontend/components/onboarding/OnboardingWizard.tsx`）が全フォーム状態をクライアント側で保持し、7つの内部ステップ（`org-name → org-policy → org-invitations → group-prompt → group-name → group-policy → done`）を4つの表示フェーズ（組織設定 / 招待 / グループ設定 / 完了）にグルーピングしている。`group-*` ステップはスキップ可能（`group-prompt`で選択）。最終レビュー画面の「始める」ボタンを押すまでバックエンドには何も送信されず、そこで初めて `POST /api/organizations`（＋ポリシー）、招待行ごとの `POST /api/organizations/<id>/invitations`、設定していれば `POST /api/organizations/<id>/groups`（＋ポリシー）を呼び出し、作成したグループのノート一覧へ（グループを作らなかった場合は組織のグループ一覧へ）遷移する。

## Phase 7: 未着手項目

- **監査ログ** — 誰が何を変更したかの記録・閲覧機能。現状は変更履歴を追う手段がない
- **高度な組織/グループポリシー** — `OrganizationPolicy` / `GroupPolicy` がすでにカバーしている設定（グループ作成権限、参加方式、非公開許可等）を超えた、より細かいポリシー制御

## 次に着手する際の注意点

- Phase 7残タスクに着手する前に、[database.md](./database.md) のテーブル定義が最新か（特に監査ログ用の新規テーブルが必要になるため）確認すること
- モデルを追加・変更した場合は [development.md](./development.md) のマイグレーション手順に従うこと
