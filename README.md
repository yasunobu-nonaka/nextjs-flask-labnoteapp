# Lab Note App

This is a demo note application built as a portfolio piece.
Please do not use for a real production environment.

## Overview

A lab note (research memo) application for researchers. Started as a personal Markdown note-taking tool and has since been extended into an organization/group-based shared note platform: organizations contain groups, groups contain notes, and access is controlled via role-based permissions (RBAC).

See [docs/overview.md](docs/overview.md) for the full picture, or browse the rest of [docs/](docs/) for architecture, domain model, database schema (with ER diagrams), API reference, development setup, and the project roadmap.

## (Assumed) Requirements

- Users are lab scientists. 使用者は科学の研究者
- Users think paper lab notebooks are difficult to share with others and search notebooks they are looking for. ユーザーは紙のノートは他人との共有や過去のノートを探すのが難しいと考えている。
- Users hope to create notes easily and quickly, as they do with paper notebooks. ユーザーは紙のノートのように簡単で早く電子ノートを作成できるように望んでいる。
- Users belong to a lab or team and want to share notes within it, while keeping some notes private. ユーザーは研究室やチームに所属しており、その中でノートを共有したいが、一部は非公開にしたい。

## Used techs

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
