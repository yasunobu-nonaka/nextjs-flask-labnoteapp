# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

Lab note application for researchers. Users create Markdown notes, organize them with tags and folders, and search by keyword or tag.

Three Docker services defined in `compose.yaml`:
- **frontend** — Next.js 16 / React 19, port 3000
- **backend** — Flask, port 8000 (mapped from container port 5000)
- **db** — PostgreSQL 16, port 5432

## Commands

### Start / stop the full stack
```bash
docker compose up -d
docker compose down
```

### Frontend (run inside the `frontend/` directory)
```bash
npm run dev        # dev server
npx tsc --noEmit   # type check (no build output)
npm run lint       # ESLint
```

### Backend tests (run from `backend/`)
```bash
pytest             # all tests (uses SQLite in-memory via TestingConfig)
pytest tests/test_notes.py          # single file
pytest tests/test_notes.py::test_fn # single test
```

Tests load `.env.development` via `conftest.py` but connect to SQLite, so no running Docker DB is needed.

### Database migrations
Migrations **must run inside the Docker container** — the DB host `db` is only reachable from within the Docker network.

```bash
docker exec flask-backend-api flask db migrate -m "message"
docker exec flask-backend-api flask db upgrade
```

After adding or changing a model, always regenerate and apply migrations before testing API changes.

## Backend Architecture

Entry point: `backend/app/__init__.py` — `create_app()` initialises extensions and registers `api_bp`.

```
app/
  api/
    __init__.py        # api_bp (prefix /api), registers sub-blueprints
    auth/              # /api/auth — register, login, email verify
    notes/             # /api/notes — CRUD, tag list, folder filter
    folders/           # /api/folders — folder CRUD
  model/               # SQLAlchemy 2.0 Mapped / mapped_column style
  schema/              # Marshmallow schemas (validation + serialisation)
  extensions/          # db, migrate, jwt, mail, cors — each in own file
  config.py            # DevelopmentConfig / TestingConfig / ProductionConfig
```

**Request flow**: route → Marshmallow `schema.load()` validation → `*_service.py` function → Marshmallow `schema.dump()` → JSON response.

**Auth**: Flask-JWT-Extended. All `/api/notes` and `/api/folders` routes require `@jwt_required()`. `current_user` is resolved via `user_lookup_callback` in `create_app`.

**Models**:
- `User` ← owns → `Note`, `Tag`, `Folder`
- `Note` ↔ `Tag` (many-to-many via `notes_tags` association table)
- `Folder` self-referential (`parent_id` → `Folder.id`); cascade-deletes children and owned notes

## Frontend Architecture

Next.js 16 App Router. All pages under `frontend/app/` are Server Components by default; interactive pages add `"use client"` at the top.

```
app/
  notes/
    page.tsx           # note list with folder sidebar, search, tag filter, pagination
    new/page.tsx       # create note
    [id]/page.tsx      # note detail (read-only)
    [id]/edit/page.tsx # edit note
components/
  FolderSidebar.tsx    # folder tree with inline CRUD
  NoteCard.tsx         # note list item; owns menu + move-to-folder state machine
  NoteForm.tsx         # shared create/edit form; owns useForm + useTagInput
lib/
  api.ts               # authFetch — wraps fetch with JWT Bearer header and base URL
  folders.ts           # Folder type, buildFolderOptions (flat list → <select> options)
  noteSchema.ts        # Zod schema + NoteFormValues type (shared by new and edit pages)
  useTagInput.ts       # custom hook managing tag input state
```

**API calls**: always use `authFetch(path, init?)` from `lib/api.ts`. It prepends `NEXT_PUBLIC_API_URL` and attaches the JWT token from `localStorage`.

**Forms**: `NoteForm` owns `useForm<NoteFormValues>` with `zodResolver(noteSchema)`. Pass `defaultValues` as a prop. In the edit page, render `<NoteForm>` only after data loads so `defaultValues` are correct on mount — no `reset()` needed.

**Folder select in new note**: the "新規作成" link appends `?folder_id=X` when a folder is selected. `new/page.tsx` reads this from `window.location.search` on mount and includes it in the POST body. No folder selector appears in the form itself.

**Note moving**: `NoteCard` uses a `"idle" | "menu" | "moving"` state machine. A fixed transparent overlay div closes the menu on outside click. After a successful PATCH, it calls `onMoved()`, which increments `refreshKey` in `NotesPage` to trigger a re-fetch.
