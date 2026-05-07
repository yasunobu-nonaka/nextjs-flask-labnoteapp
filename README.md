# Lab Note App

This is demo note application as portfolio.
Please do not use for real production environment.

## (Assumed) Requirements

- Users are Lab scientists. 使用者は科学の研究者
- Users think paper lab notebooks are difficult to share with others and search notebooks they are looking for. ユーザーは紙のノートは他人との共有や過去のノートを探すのが難しいと考えている。
- Users hope to create notes easily and quickly as they do with paper notebooks. ユーザーは紙のノートのように簡単で早く電子ノートを作成できるように望んでいる。

## (Assumed) Functional Requirements

- create notebook as markdown document for easy and quick note creation experience. Markdown形式でのノート作成により簡単で早いノート作成を実現する。
- note tag functionality for grouping and classification. グルーピングと分類のためのノートタグ機能
- search notebooks by keyword and tag. キーワードとタグでノート検索することで簡単にノートを探せるようにする。

## Used techs

Language

- Python...programming language. python is chosen because 1. the language I am most familiar with. 2. readable syntax with indent. 3. wide package ecosystems that enable to implement functionalities I want. 4. easy adaptation with graph making, data analysis, and AI functionalities that possibly be implemented in the future.

Frontend

- Next.js...React frameword

Backend

- Flask...a lightweight WSGI web application framework. Easy usage because of microframework. Large ecosystems of authentication, database access, forms etc.
- Flask-SQLAlchemy...O/R mapper.
- Flask-Migrate...Database migration.
- Flask-Login...use authentication and session management.
- Flask-WTF...form creation with security.
- pytest...application testing.
- bleach...HTML sanitizer. mainly used before display note.
- markdown-it-py, mdit-py-plugins...convert markdown to HTML.
