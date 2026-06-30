# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Conventions

- Prefer clarity over brevity. Slightly verbose code is acceptable if it makes the logic easier to follow.
- Add comments to functions, classes, React hooks, and React component JSX to explain their role and the purpose of key elements within them.

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
    notes/             # note_service.py, tag_service.py (no routes; moved to organizations/)
    folders/           # folder_service.py (no routes; moved to organizations/)
    organizations/     # /api/organizations — org/group CRUD + note/folder routes
      note_routes.py   # /api/organizations/<org_id>/groups/<group_id>/notes
      folder_routes.py # /api/organizations/<org_id>/groups/<group_id>/folders
  model/               # SQLAlchemy 2.0 Mapped / mapped_column style
  schema/              # Marshmallow schemas (validation + serialisation)
  extensions/          # db, migrate, jwt, mail, cors — each in own file
  config.py            # DevelopmentConfig / TestingConfig / ProductionConfig
```

**Request flow**: route → Marshmallow `schema.load()` validation → `*_service.py` function → Marshmallow `schema.dump()` → JSON response.

**Auth**: Flask-JWT-Extended. All group-scoped note/folder routes require `@jwt_required()` plus RBAC permission checks via `check_org_permission()` and `check_group_permission()`. `current_user` is resolved via `user_lookup_callback` in `create_app`.

**Models**:
- `Group` ← owns → `Note`, `Tag`, `Folder` (Phase 3: moved from User)
- `Note` has `group_id` (FK → groups.id) and `created_by_user_id` (FK → users.id)
- `Tag` has `group_id` (FK → groups.id); unique on `(group_id, tagname)`
- `Folder` has `group_id` (FK → groups.id) and `created_by_user_id` (FK → users.id)
- `Note` ↔ `Tag` (many-to-many via `notes_tags` association table)
- `Folder` self-referential (`parent_id` → `Folder.id`); cascade-deletes children and owned notes

## Frontend Architecture

Next.js 16 App Router. All pages under `frontend/app/` are Server Components by default; interactive pages add `"use client"` at the top.

```
app/
  organizations/
    page.tsx                              # org list; shows orgs the user belongs to + OrgCreateModal
    [orgId]/
      admin/
        layout.tsx                        # org admin sidebar layout
        page.tsx                          # org admin dashboard (name, policy overview)
        policy/page.tsx                   # edit org-level policy (who_can_create_groups, etc.)
        groups/page.tsx                   # group list for org admins; create/delete groups
        members/
          page.tsx                        # org member list; role change, remove, add by email
          invite/page.tsx                 # send email invitation to join org (Phase 5)
      groups/
        page.tsx                          # group list for org members; join / enter group
        [groupId]/
          admin/
            layout.tsx                    # group admin sidebar layout
            page.tsx                      # group admin dashboard
            policy/page.tsx               # edit group-level policy (join_method, visibility)
            members/page.tsx              # group member list; role change, remove, add
          notes/
            page.tsx                      # file-browser style note list; folder+note grid, breadcrumb, search, tag filter, pagination
            new/page.tsx                  # create note
            [noteId]/page.tsx             # note detail (read-only)
            [noteId]/edit/page.tsx        # edit note
  invitations/
    [token]/page.tsx                      # accept email invitation link (Phase 5)
components/
  AppHeader.tsx          # top navigation bar; org switcher, user menu
  OrgCreateModal.tsx     # create organization form (name input)
  OrgSwitchModal.tsx     # switch between orgs the user belongs to
  CreateGroupWizard.tsx  # multi-step group creation wizard (name, visibility, policy)
  GroupCreateModal.tsx   # simple group create modal (used from admin/groups)
  GroupListModal.tsx     # group list picker modal
  FolderSidebar.tsx      # left sidebar: keyword search form + tag filter checkboxes
  FolderCard.tsx         # folder card (tab design); owns ··· menu popover, rename/delete modals
  FolderBreadcrumb.tsx   # breadcrumb navigation for folder hierarchy
  FolderCreateModal.tsx  # create folder modal
  NoteCard.tsx           # note card; owns ··· menu popover + move-to-folder modal
  NoteShareModal.tsx     # note share settings modal
  NoteForm.tsx           # shared create/edit form; owns useForm + useTagInput
  NewItemButton.tsx      # "新規作成" button that opens popover (note / folder)
  Modal.tsx              # generic modal shell (backdrop + dialog box); content passed as children
  ConfirmModal.tsx       # generic confirmation dialog (yes/no)
  RadioGroup.tsx         # reusable radio button group component
  MarkdownEditor.tsx     # Markdown editor wrapper
lib/
  api.ts                 # authFetch — wraps fetch with JWT Bearer header and base URL
  folders.ts             # Folder type, buildFolderOptions (flat list → <select> options)
  types.ts               # shared TypeScript types (OrgPolicy, GroupPolicy, Member, etc.)
  constants.ts           # display label maps (ORG_ROLE_LABELS, etc.)
  utils.ts               # formatDate and other shared utilities
  schemas/
    noteSchema.ts        # Zod schema + NoteFormValues type (shared by new and edit pages)
  hooks/
    useTagInput.ts       # custom hook managing tag input state
```

**API calls**: always use `authFetch(path, init?)` from `lib/api.ts`. It prepends `NEXT_PUBLIC_API_URL` and attaches the JWT token from `localStorage`.

**Forms**: `NoteForm` owns `useForm<NoteFormValues>` with `zodResolver(noteSchema)`. Pass `defaultValues` as a prop. In the edit page, render `<NoteForm>` only after data loads so `defaultValues` are correct on mount — no `reset()` needed.

**Folder navigation**: `NotesPage` tracks position with `currentFolderId` (null = root). All folders are fetched once on mount into `allFolders`; `currentLevelFolders` is derived client-side by filtering `parent_id === currentFolderId`. Breadcrumb is built by traversing `parent_id` upward from `currentFolderId`. Root view shows top-level folders + notes with no folder (sends `folder_id=null` string sentinel to API).

**New item creation**: The "新規作成" button (`NewItemButton`) opens a popover menu. "ノート" navigates to `notes/new`; "フォルダー" opens a `Modal` for folder name input.

**Note moving**: `NoteCard` uses a `"idle" | "menu" | "moving"` state machine. `mode === "moving"` opens a `Modal` with a folder `<select>`. After a successful PATCH, it calls `onMoved()`, which increments `refreshKey` in `NotesPage` to trigger a re-fetch.

**Layout**: Notes page uses `h-screen overflow-hidden` on the root `<main>` with `overflow-y-auto` on each column so the sidebar and content area scroll independently.

## Organization & Group Redesign

The app is being extended from a personal note tool to an organization/group-based shared note platform. Implementation is phased; **Phase 4 (frontend) is complete. Phase 5 is partially done.**

### Phase Plan

| Phase | Status | Content |
|-------|--------|---------|
| 1 | ✅ Done | Organization & Group models, membership, basic API |
| 2 | ✅ Done | Full RBAC (Permission / RoleGlobal / RoleLocal models) |
| 3 | ✅ Done | Migrate Note / Tag / Folder ownership from User → Group |
| 4 | ✅ Done | Frontend — org creation UI, group management, member management |
| 5 | 🔄 Partial | Email invitations ✅ done; audit log and advanced policies pending |

### Domain Concepts

- **Organization**: the largest sharing unit; notes are never exposed outside it
- **Group**: a subset of an organization; notes are basically created inside a group
- **OrganizationPolicy**: per-org settings (1:1); who can create groups, default join method, etc.
- **GroupPolicy**: per-group settings (1:1); note visibility to org, join method, etc.
- Group visibility defaults to public within the org; notes default to visible within the group

### Roles and Permissions (Phase 2 RBAC)

**Organization-level roles** (`OrganizationMember.role_id → RoleGlobal`):
`owner` | `sys_admin` | `user_admin` | `member`

**Group-level roles** (`GroupMember.role_id → RoleLocal`):
`admin` | `editor` | `viewer`

Roles store their permissions in `Permission` objects (code strings like `org:edit`, `note:read`).
Use `member.role.name` for the string name; `member.role.has_permission(code)` for fine-grained checks.
Helper functions `check_org_permission()` and `check_group_permission()` are available in the service files.

**Permission codes — organization level:**
`org:read` / `org:edit` / `org:delete` / `org:member_add` / `org:member_remove` /
`org:member_role_assign` / `org:group_create` / `org:group_manage_any`

**Permission codes — group level:**
`group:read` / `group:edit` / `group:delete` / `group:member_add` / `group:member_remove` /
`group:member_role_assign` / `note:create` / `note:read` / `note:edit` / `note:delete`

### DB Models (Phase 1 + 2 + 3 additions)

```
Permission           — code (unique), description
RoleGlobal           — name (unique), permissions (M2M via role_global_permissions)
RoleLocal            — name (unique), permissions (M2M via role_local_permissions)

Organization         — name, created_by_user_id
OrganizationMember   — user_id + organization_id (composite PK), role_id → RoleGlobal, joined_at
OrganizationPolicy   — organization_id (unique FK), allow_private_groups,
                       allow_private_notes, who_can_create_groups, default_join_method
Group                — organization_id, name, is_private, created_by_user_id
GroupMember          — user_id + group_id (composite PK), role_id → RoleLocal, joined_at
GroupPolicy          — group_id (unique FK), allow_private_notes,
                       join_method, is_notes_visible_to_org

Note                 — group_id (FK → groups.id), created_by_user_id (FK → users.id),
                       title, content, created_at, updated_at
Tag                  — group_id (FK → groups.id), tagname; unique (group_id, tagname)
Folder               — group_id (FK → groups.id), created_by_user_id (FK → users.id),
                       name, parent_id (self-ref FK)
```

RBAC seed data is inserted by `app/model/seed_rbac.py`. Tests call `seed_rbac()` in `conftest.py` after `db.create_all()`. Production uses the Alembic migration `e006c8e3c75a` (Phase 2) followed by `a1b2c3d4e5f6` (Phase 3).

### API Blueprint (Phase 1 + 3)

`app/api/organizations/` — registered as `/api/organizations`

#### Organization & Group routes (Phase 1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/organizations` | JWT | List orgs the current user belongs to |
| POST | `/api/organizations` | JWT | Create org (caller becomes `owner`) |
| GET | `/api/organizations/<id>` | member | Org detail + policy |
| PATCH | `/api/organizations/<id>` | owner/sys_admin | Update org name or policy |
| GET | `/api/organizations/<id>/members` | member | List members |
| POST | `/api/organizations/<id>/members` | owner/sys_admin/user_admin | Add member |
| PATCH | `/api/organizations/<id>/members/<uid>` | owner/sys_admin | Change member role |
| DELETE | `/api/organizations/<id>/members/<uid>` | owner/sys_admin/user_admin | Remove member |
| GET | `/api/organizations/<id>/groups` | member | List accessible groups |
| POST | `/api/organizations/<id>/groups` | policy-dependent | Create group (caller becomes `admin`) |
| GET | `/api/organizations/<id>/groups/<gid>` | member (private: group member only) | Group detail + policy |
| PATCH | `/api/organizations/<id>/groups/<gid>` | group admin / org sys_admin | Update group name, visibility, policy |
| DELETE | `/api/organizations/<id>/groups/<gid>` | group admin / org sys_admin | Delete group |
| GET | `/api/organizations/<id>/groups/<gid>/members` | group member | List group members |
| POST | `/api/organizations/<id>/groups/<gid>/members` | group admin / org sys_admin | Add org member to group |
| PATCH | `/api/organizations/<id>/groups/<gid>/members/<uid>` | group admin / org sys_admin | Change group member role |
| DELETE | `/api/organizations/<id>/groups/<gid>/members/<uid>` | group admin / org sys_admin | Remove member from group |

Service functions live in `organization_service.py` and `group_service.py` inside `app/api/organizations/`.

#### Note & Folder routes (Phase 3)

All routes require `org:read` org-level permission plus the group-level permission shown below.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/organizations/<id>/groups/<gid>/notes` | `note:read` | List notes in group |
| POST | `/api/organizations/<id>/groups/<gid>/notes` | `note:create` | Create note in group |
| GET | `/api/organizations/<id>/groups/<gid>/notes/tags` | `note:read` | List tags in group |
| GET | `/api/organizations/<id>/groups/<gid>/notes/<nid>` | `note:read` | Get note |
| PATCH | `/api/organizations/<id>/groups/<gid>/notes/<nid>` | `note:edit` | Update note |
| DELETE | `/api/organizations/<id>/groups/<gid>/notes/<nid>` | `note:delete` | Delete note |
| GET | `/api/organizations/<id>/groups/<gid>/folders` | `note:read` | List folders in group |
| POST | `/api/organizations/<id>/groups/<gid>/folders` | `note:create` | Create folder in group |
| PATCH | `/api/organizations/<id>/groups/<gid>/folders/<fid>` | `note:edit` | Rename folder |
| DELETE | `/api/organizations/<id>/groups/<gid>/folders/<fid>` | `note:delete` | Delete folder |

Route implementations live in `note_routes.py` and `folder_routes.py` inside `app/api/organizations/`.
