# Lab Note App

This is a demo note application built as a portfolio piece.
Please do not use for a real production environment.

## Overview

A lab note (research memo) application for researchers. Started as a personal Markdown note-taking tool and has since been extended into an organization/group-based shared note platform: organizations contain groups, groups contain notes, and access is controlled via role-based permissions (RBAC).

See [docs/overview.md](docs/overview.md) for the full picture, or browse the rest of [docs/](docs/) for architecture, domain model, database schema (with ER diagrams), API reference, development setup, and the project roadmap.

## Getting Started

```bash
cp backend/.env.development.sample backend/.env.development
docker compose up -d
```

- frontend: http://localhost:3000
- backend: http://localhost:8000
- db: localhost:5432

See [docs/development.md](docs/development.md) for environment variable details, running the frontend/backend outside Docker, running tests, and database migrations.

## Assumed User Needs

- Users are lab scientists. 使用者は科学の研究者
- Users think paper lab notebooks are difficult to share with others and search notebooks they are looking for. ユーザーは紙のノートは他人との共有や過去のノートを探すのが難しいと考えている。
- Users hope to create notes easily and quickly, as they do with paper notebooks. ユーザーは紙のノートのように簡単で早く電子ノートを作成できるように望んでいる。
- Users' organization wants to manage multiple teams under one roof — each group creates and shares its own notes internally, while the organization keeps central control over org-wide policy (who can create groups, how members join). Notes stay scoped to their own group by default and never leave the organization. 組織として複数チームを一元管理したい。各グループはグループ内でノートを作成・共有し、組織はグループ作成権限や参加方式などのポリシーを統制する。ノートはデフォルトではグループ外に出ることはない。
- Users would like to keep some notes secret and share with limited group members. グループ内の一部のノートは非公開にして一部のメンバーだけが共有できるようにしたい。

## How These Needs Are Addressed

| Need                                                       | Feature                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Sharing & finding past notes is hard on paper              | Keyword / tag / author search, folder organization                                       |
| Want to write notes as quickly and intuitively as on paper | Markdown editor                                                                          |
| Keep some notes secret, share only with specific members   | Per-note private sharing (`is_private` flag + explicit member list)                      |
| Manage multiple teams under one organization               | Organization → Group hierarchy with role-based permissions (RBAC) and org-level policies |

## Tech Stack

**Frontend**

- Next.js 16 (App Router) / React 19 / TypeScript
- Tailwind CSS
- react-hook-form + zod（フォーム・バリデーション）
- @uiw/react-md-editor / react-markdown + remark-gfm（Markdown編集・表示）
- Jest / React Testing Library / MSW（テスト）

**Backend**

- Python / Flask（軽量なWSGIフレームワーク。認証・DB・バリデーション等のエコシステムが充実）
- Flask-SQLAlchemy（O/Rマッパー） / Flask-Migrate（Alembicによるマイグレーション）
- Marshmallow（バリデーション・シリアライズ）
- Flask-JWT-Extended（認証） / Flask-Mail（確認メール・招待メール等）
- pytest（テスト）

**Database**

- PostgreSQL 16（Docker） / SQLite（テスト時）

## License

[MIT](./LICENSE)
