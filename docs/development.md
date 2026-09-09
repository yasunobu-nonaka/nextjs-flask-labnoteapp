# 開発環境セットアップ・コマンド

## 前提

- Docker / Docker Compose
- Node.js（frontendをDocker外で直接動かす場合）
- Python（backendのテストをDocker外で直接動かす場合）

## 初回セットアップ

1. `backend/.env.development.sample` を `backend/.env.development` にコピーし、値を編集する（`compose.yaml` の `backend` / `db` サービスがこのファイルを読み込む）。

```bash
cp backend/.env.development.sample backend/.env.development
```

| 変数 | 用途 |
|------|------|
| `FRONTEND_URL` | メール内リンクなどで参照するフロントエンドのURL |
| `FLASK_CONFIG` / `FLASK_APP` / `FLASK_DEBUG` | Flask起動設定 |
| `SECRET_KEY` / `JWT_SECRET_KEY` | セッション・JWT署名鍵 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQLの接続情報（`db`サービスと共有） |
| `DEV_MAIL_*` | 開発環境でのメール送信設定（確認メール・招待メール・パスワードリセット等） |

2. スタックを起動する。

```bash
docker compose up -d
```

- frontend: http://localhost:3000
- backend: http://localhost:8000（コンテナ内は5000番、`compose.yaml` でホストの8000番にマッピング）
- db: localhost:5432

停止する場合:

```bash
docker compose down
```

## フロントエンド（`frontend/` ディレクトリ内で実行）

```bash
npm run dev         # 開発サーバー
npx tsc --noEmit    # 型チェック（出力ファイルなし）
npm run lint        # ESLint
npm run test        # Jest（全テスト）
npm run test:watch  # Jest（watchモード）
```

テストは Jest + React Testing Library + MSW（APIモック）で構成されている。テストファイルは対象コンポーネント/フックと同じディレクトリに `*.test.tsx` として置く（例: `components/folder/FolderCreateModal.test.tsx`）。

## バックエンドテスト（`backend/` ディレクトリ内で実行）

```bash
pytest                                # 全テスト
pytest tests/test_notes.py            # 単一ファイル
pytest tests/test_notes.py::test_fn   # 単一テスト
```

`TestingConfig` によりインメモリSQLiteに接続するため、Dockerの `db` サービスを起動していなくてもテストできる。`conftest.py` が `.env.development` を読み込み、`db.create_all()` 後に `seed_rbac()` でRBACのシードデータを投入する。

## データベースマイグレーション

**マイグレーションはDockerコンテナ内で実行する必要がある**（DBホスト `db` はDockerネットワーク内からしか到達できないため）。

```bash
docker exec flask-backend-api flask db migrate -m "message"
docker exec flask-backend-api flask db upgrade
```

モデルを追加・変更した後は、APIの動作確認をする前に必ずマイグレーションを生成・適用すること。

## コンテナ名

`compose.yaml` で定義されているコンテナ名（`docker exec` 等で使用）。

| サービス | コンテナ名 |
|---------|-----------|
| backend | `flask-backend-api` |
| frontend | `nextjs-frontend` |
| db | `postgresql-db` |
