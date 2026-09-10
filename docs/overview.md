# プロジェクト概要

## アプリケーションについて

研究者向けのラボノート（実験記録・研究メモ）管理アプリケーション。ユーザーは Markdown 形式でノートを作成し、タグやフォルダーで整理し、キーワードやタグで検索できる。

単なる個人用メモツールではなく、**組織（Organization）／グループ（Group）単位でノートを共有する** プラットフォームとして設計されている。研究室やチームが組織を作り、その中にグループ（例: プロジェクト単位、テーマ単位）を作成し、グループに所属するメンバー同士でノートを共有する運用を想定している。

## 対象ユーザー

- 個人の研究メモを整理したい研究者
- チーム・研究室単位でノートを共有したい組織

## 主な機能

- Markdown によるノート作成・編集
- フォルダーによる階層的な整理
- タグ付け・キーワード検索・作成者フィルタ
- 組織／グループ単位のアクセス制御（RBAC）
- ノート単位の非公開設定（特定メンバーのみ閲覧可）
- メール招待によるメンバー追加、グループ参加申請・承認フロー
- 新規登録ユーザー向けのオンボーディングウィザード（組織・グループの初期設定）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16 (App Router) / React 19 / TypeScript |
| バックエンド | Flask / SQLAlchemy 2.0 / Marshmallow |
| データベース | PostgreSQL 16（本番）/ SQLite（テスト） |
| 認証 | Flask-JWT-Extended（アクセストークン + リフレッシュトークン） |
| フロントエンドテスト | Jest / React Testing Library / MSW |
| 実行環境 | Docker Compose（frontend / backend / db の3サービス） |

## 開発状況

組織／グループ共有機能への拡張（Organization & Group Redesign）を Phase 1〜7 に分けて進めている。Phase 1〜6 は完了済み、Phase 7 はオンボーディングウィザードまで完了し、監査ログと高度なポリシー機能が未着手。詳細は [roadmap.md](./roadmap.md) を参照。

## ドキュメント構成

- [architecture.md](./architecture.md) — システム構成、backend/frontend のディレクトリ構造
- [domain-model.md](./domain-model.md) — Organization / Group / Role / Permission などのドメイン概念
- [database.md](./database.md) — テーブル定義・ER図・制約
- [api-reference.md](./api-reference.md) — API ルート一覧
- [development.md](./development.md) — セットアップ・コマンド・マイグレーション手順
- [testing.md](./testing.md) — 各テストファイルの内容一覧
- [roadmap.md](./roadmap.md) — フェーズ計画
