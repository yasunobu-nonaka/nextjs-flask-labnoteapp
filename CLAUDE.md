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
    __init__.py           # api_bp (prefix /api), registers sub-blueprints
    auth/                 # /api/auth — register, login, email verify, refresh, me (get/update/delete),
                          #             password reset, email change, username change, account deletion
    invitations/          # /api/invitations — public token-based invitation acceptance (no JWT needed for GET)
    notifications/        # /api/notifications — in-app notifications (join request approvals/rejections)
    notes/                # note_service.py, tag_service.py (no routes; moved to organizations/)
    folders/              # folder_service.py (no routes; moved to organizations/)
    organizations/        # /api/organizations — org/group CRUD + note/folder routes
      routes.py           # org routes, group routes, join request routes
      note_routes.py      # /api/organizations/<org_id>/groups/<group_id>/notes + private note members
      folder_routes.py    # /api/organizations/<org_id>/groups/<group_id>/folders
      invitation_routes.py# /api/organizations/<org_id>/invitations — send email invitations
      invitation_service.py
      organization_service.py
      group_service.py
  model/                  # SQLAlchemy 2.0 Mapped / mapped_column style
  schema/                 # Marshmallow schemas (validation + serialisation)
  extensions/             # db, migrate, jwt, mail, cors — each in own file
  services/
    mail_service.py       # send transactional emails (verification, invitation, password reset, etc.)
  config.py               # DevelopmentConfig / TestingConfig / ProductionConfig
```

**Request flow**: route → Marshmallow `schema.load()` validation → `*_service.py` function → Marshmallow `schema.dump()` → JSON response.

**Auth**: Flask-JWT-Extended. All group-scoped note/folder routes require `@jwt_required()` plus RBAC permission checks via `check_org_permission()` and `check_group_permission()`. `current_user` is resolved via `user_lookup_callback` in `create_app`.

**Models**:
- `Group` ← owns → `Note`, `Tag`, `Folder` (Phase 3: moved from User)
- `Note` has `group_id` (FK → groups.id), `created_by_user_id` (FK → users.id), and `is_private` flag
- `Tag` has `group_id` (FK → groups.id); unique on `(group_id, tagname)`
- `Folder` has `group_id` (FK → groups.id) and `created_by_user_id` (FK → users.id)
- `Note` ↔ `Tag` (many-to-many via `notes_tags` association table)
- `Folder` self-referential (`parent_id` → `Folder.id`); cascade-deletes children and owned notes
- `GroupMember.status`: `'active'` (normal member) | `'pending'` (join request awaiting approval) | `'rejected'`

## Frontend Architecture

Next.js 16 App Router. All pages under `frontend/app/` are Server Components by default; interactive pages add `"use client"` at the top.

```
app/
  page.tsx                                # root; redirects to /organizations
  login/page.tsx                          # login form
  register/page.tsx                       # registration form (username, email, password)
  forgot-password/page.tsx                # request password reset email
  reset-password/[token]/page.tsx         # set new password via reset token
  verify-email/[token]/page.tsx           # email address verification on registration
  verify-email-change/[token]/page.tsx    # email address change verification
  invitations/
    [token]/page.tsx                      # accept email invitation link (Phase 5)
  onboarding/
    page.tsx                              # setup wizard for new self-registered users (Phase 7); redirects to /organizations if needs_onboarding is false
  settings/
    layout.tsx                            # settings sidebar layout
    page.tsx                              # profile settings (username change)
    security/page.tsx                     # security settings (password change, email change, account deletion)
  organizations/
    page.tsx                              # org list; shows orgs the user belongs to + OrgCreateModal
    [orgId]/
      admin/
        layout.tsx                        # org admin sidebar layout; non-admins are allowed in but confined to members/ (read-only)
        admin-context.tsx                 # AdminContext — isAdmin flag from layout, consumed by members/page.tsx
        page.tsx                          # org admin dashboard (name, policy overview); org deletion (owner only)
        policy/page.tsx                   # edit org-level policy (who_can_create_groups, etc.)
        groups/page.tsx                   # group list for org admins; create/delete groups
        members/
          page.tsx                        # org member list; role change, remove, add by email, ownership transfer, self-leave (owner blocked until transfer)
          invite/page.tsx                 # send email invitation to join org (Phase 5)
      groups/
        page.tsx                          # group list for org members; join / enter group
        [groupId]/
          admin/
            layout.tsx                    # group admin sidebar layout; non-admins are allowed in but confined to members/ (read-only)
            pending-count-context.ts      # PendingCountContext — join-request count + isAdmin flag, consumed by members/page.tsx
            page.tsx                      # group admin dashboard; join request count badge; group deletion (group admin only)
            policy/page.tsx               # edit group-level policy (join_method, visibility)
            members/page.tsx              # group member list; role change, remove, add, join request approval, self-leave (sole admin blocked)
          notes/
            page.tsx                      # file-browser style note list; folder+note grid, breadcrumb, search, tag filter, pagination
            new/page.tsx                  # create note
            [noteId]/page.tsx             # note detail (read-only); private badge, share management
            [noteId]/edit/page.tsx        # edit note
components/
  common/
    Modal.tsx            # generic modal shell (backdrop + dialog box); content passed as children
    ConfirmModal.tsx     # generic confirmation dialog (yes/no)
    RadioGroup.tsx       # reusable radio button group component
  layout/
    AppHeader.tsx        # top navigation bar; org switcher, user menu; confirmBeforeLeave prop guards its own Links/logout against unsaved-changes navigation
  org/
    OrgCreateModal.tsx   # create organization form (name input)
    OrgSwitchModal.tsx   # switch between orgs the user belongs to; exports OrgList
  group/
    CreateGroupWizard.tsx  # multi-step group creation wizard (name, visibility, policy)
    GroupCreateModal.tsx   # simple group create modal (used from admin/groups)
    GroupListModal.tsx     # group list picker modal; exports GroupList
  onboarding/
    OnboardingWizard.tsx   # Phase 7 setup wizard; org name/policy/invites + optional first group, submitted in one batch on the final "始める" step
  folder/
    FolderSidebar.tsx    # left sidebar: keyword search form + tag filter checkboxes
    FolderCard.tsx       # folder card (tab design); owns ··· menu popover, rename/delete modals
    FolderBreadcrumb.tsx # breadcrumb navigation for folder hierarchy
    FolderCreateModal.tsx# create folder modal
  note/
    NoteCard.tsx         # note card; owns ··· menu popover + move-to-folder modal; exports PrivateMember type
    NoteForm.tsx         # shared create/edit form; owns useForm + useTagInput; reports formState.isDirty via onDirtyChange prop
    NoteShareModal.tsx   # note share settings modal (private note member management)
    MarkdownEditor.tsx   # Markdown editor wrapper
    NewItemButton.tsx    # "新規作成" button that opens popover (note / folder)
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
    useUnsavedChangesGuard.ts # takes isDirty; adds a beforeunload listener and returns confirmBeforeLeave for AppHeader
```

**API calls**: always use `authFetch(path, init?)` from `lib/api.ts`. It prepends `NEXT_PUBLIC_API_URL` and attaches the JWT token from `localStorage`.

**Forms**: `NoteForm` owns `useForm<NoteFormValues>` with `zodResolver(noteSchema)`. Pass `defaultValues` as a prop. In the edit page, render `<NoteForm>` only after data loads so `defaultValues` are correct on mount — no `reset()` needed.

**Folder navigation**: `NotesPage` tracks position with `currentFolderId` (null = root). All folders are fetched once on mount into `allFolders`; `currentLevelFolders` is derived client-side by filtering `parent_id === currentFolderId`. Breadcrumb is built by traversing `parent_id` upward from `currentFolderId`. Root view shows top-level folders + notes with no folder (sends `folder_id=null` string sentinel to API).

**New item creation**: The "新規作成" button (`NewItemButton`) opens a popover menu. "ノート" navigates to `notes/new`; "フォルダー" opens a `Modal` for folder name input.

**Note moving**: `NoteCard` uses a `"idle" | "menu" | "moving"` state machine. `mode === "moving"` opens a `Modal` with a folder `<select>`. After a successful PATCH, it calls `onMoved()`, which increments `refreshKey` in `NotesPage` to trigger a re-fetch.

**Unsaved-changes guard on note create/edit**: `NoteForm` reports `formState.isDirty` up to the page via `onDirtyChange` (note `content_md`/`tags` are set via `setValue(..., { shouldDirty: true })` since they bypass `register()` and wouldn't otherwise count toward `isDirty`). The page holds that in its own `isDirty` state, resets it to `false` right before the post-save `router.push` (so the save's own navigation isn't blocked), and passes it to `useUnsavedChangesGuard(isDirty)`, which returns a `confirmBeforeLeave` function. That function is passed to `AppHeader`, which calls it from every internal `<Link>`'s `onNavigate` (via a shared `guardNavigate` helper) and from the logout button, prompting via `window.confirm` and cancelling navigation if declined. The same hook also registers a `beforeunload` listener for tab-close/reload/URL-bar navigation, reading the latest `isDirty` through a ref (registering the listener once and mutating the ref avoids a stale-closure read). The browser back/forward button is intentionally not covered — App Router's client-side history navigation doesn't fire `beforeunload`.

**Org/group admin access**: `admin/layout.tsx` (org) and `groups/[groupId]/admin/layout.tsx` (group) no longer redirect non-admin members away entirely — they compute `isAdmin` from the caller's role and expose it via context (`AdminContext` for org, the group layout's existing `PendingCountContext` for group) so `members/page.tsx` can render a read-only member list + self-leave button for non-admins, while confining them to the members sub-route (redirecting away from other admin pages) and hiding admin-only controls (invite/add, role edit, remove, join requests). Self-leave posts to `.../leave`; the backend blocks an org owner (must transfer ownership first) and a group's sole remaining admin.

**Layout**: Notes page uses `h-screen overflow-hidden` on the root `<main>` with `overflow-y-auto` on each column so the sidebar and content area scroll independently.

## Organization & Group Redesign

The app is being extended from a personal note tool to an organization/group-based shared note platform. **Phases 1–6 are complete. Phase 7 is partially done** (onboarding wizard shipped; audit log and advanced policies are still pending).

### Phase Plan

| Phase | Status | PR(s) | Content |
|-------|--------|-------|---------|
| 1 | ✅ Done | #19 | Organization & Group models, membership, basic API |
| 2 | ✅ Done | #19 | Full RBAC (Permission / RoleGlobal / RoleLocal models) |
| 3 | ✅ Done | #19 | Migrate Note / Tag / Folder ownership from User → Group |
| 4 | ✅ Done | #19 #20 #26 | Frontend — org/group navigation, group-scoped note pages, group creation wizard, org/group list pages |
| 5 | ✅ Done | #19 #21 #22 #24 | Access control & sharing — email invitations, group join requests & approval, 404 hardening for non-members, private notes |
| 6 | ✅ Done | #8 #25 #27 | User account management — password reset, user settings (username/email change, account deletion) |
| 7 | 🔶 Partial | `9e63418` | Onboarding setup wizard — done. Audit log, advanced org/group policies — pending |

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

### DB Models

```
Permission           — code (unique), description
RoleGlobal           — name (unique), permissions (M2M via role_global_permissions)
RoleLocal            — name (unique), permissions (M2M via role_local_permissions)

Organization         — name, created_by_user_id
OrganizationMember   — user_id + organization_id (composite PK), role_id → RoleGlobal, joined_at
OrganizationPolicy   — organization_id (unique FK), allow_private_groups,
                       allow_private_notes, who_can_create_groups, default_join_method
Group                — organization_id, name, is_private, created_by_user_id
GroupMember          — user_id + group_id (composite PK), role_id → RoleLocal, joined_at,
                       status ('active' | 'pending' | 'rejected') — 'pending' = join request awaiting approval
GroupPolicy          — group_id (unique FK), allow_private_notes,
                       join_method, is_notes_visible_to_org

Note                 — group_id (FK → groups.id), created_by_user_id (FK → users.id),
                       title, content, is_private, created_at, updated_at
PrivateNoteMember    — note_id + user_id (composite PK), role ('owner' | 'editor' | 'viewer')
Tag                  — group_id (FK → groups.id), tagname; unique (group_id, tagname)
Folder               — group_id (FK → groups.id), created_by_user_id (FK → users.id),
                       name, parent_id (self-ref FK)

Invitation           — organization_id, email, token (unique), invited_by_user_id,
                       status ('pending' | 'accepted' | 'expired'), expires_at
Notification         — user_id, type, payload (JSON), is_read, created_at
```

RBAC seed data is inserted by `app/model/seed_rbac.py`. Tests call `seed_rbac()` in `conftest.py` after `db.create_all()`. Production uses Alembic migrations; key ones are `e006c8e3c75a` (Phase 2 RBAC) and `a1b2c3d4e5f6` (Phase 3 group ownership).

### API Routes

#### Auth routes (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register new user |
| GET | `/api/auth/verify/<token>` | — | Verify email on registration |
| POST | `/api/auth/resend-verification` | — | Resend verification email |
| GET | `/api/auth/user/status` | — | Check email verification status |
| POST | `/api/auth/login` | — | Login; returns access + refresh tokens |
| POST | `/api/auth/refresh` | refresh JWT | Rotate access token |
| GET | `/api/auth/me` | JWT | Get current user profile; includes `needs_onboarding` (true when the user has zero org memberships — drives the Phase 7 onboarding redirect) |
| DELETE | `/api/auth/me` | JWT | Delete account |
| PATCH | `/api/auth/me/username` | JWT | Change username |
| POST | `/api/auth/me/password/verify` | JWT | Verify current password (pre-change step) |
| PATCH | `/api/auth/me/password` | JWT | Change password |
| PATCH | `/api/auth/me/email` | JWT | Request email change (sends confirmation email) |
| GET | `/api/auth/verify-email-change/<token>` | — | Confirm email change via token |
| POST | `/api/auth/forgot-password` | — | Send password reset email |
| GET | `/api/auth/reset-password/<token>` | — | Validate reset token |
| POST | `/api/auth/reset-password/validate-token` | — | Validate reset token (JSON body) |
| POST | `/api/auth/reset-password` | — | Set new password using reset token |

#### Invitation routes (`/api/invitations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/invitations/<token>` | — | Get invitation details by token |
| POST | `/api/invitations/<token>/accept` | JWT | Accept invitation and join org |

#### Notification routes (`/api/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | JWT | List unread notifications for current user |
| PATCH | `/api/notifications/<id>/read` | JWT | Mark notification as read |
| DELETE | `/api/notifications/rejected` | JWT | Clear all rejected-request notifications |

#### Organization & Group routes (`/api/organizations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/organizations` | JWT | List orgs the current user belongs to |
| POST | `/api/organizations` | JWT | Create org (caller becomes `owner`) |
| GET | `/api/organizations/<id>` | member | Org detail + policy |
| PATCH | `/api/organizations/<id>` | owner/sys_admin | Update org name or policy |
| DELETE | `/api/organizations/<id>` | owner | Delete org (blocked if any groups exist) |
| POST | `/api/organizations/<id>/transfer-ownership` | owner | Transfer owner role to another member (caller demoted to member) |
| GET | `/api/organizations/<id>/members` | member | List members |
| POST | `/api/organizations/<id>/members` | owner/sys_admin/user_admin | Add member |
| PATCH | `/api/organizations/<id>/members/<uid>` | owner/sys_admin | Change member role |
| DELETE | `/api/organizations/<id>/members/<uid>` | owner/sys_admin/user_admin | Remove member |
| POST | `/api/organizations/<id>/leave` | member | Leave org (self); blocked if caller is `owner` (transfer ownership first) |
| POST | `/api/organizations/<id>/invitations` | owner/sys_admin/user_admin | Send email invitation to join org |
| GET | `/api/organizations/<id>/groups` | member | List accessible groups |
| POST | `/api/organizations/<id>/groups` | policy-dependent | Create group (caller becomes `admin`) |
| GET | `/api/organizations/<id>/groups/<gid>` | member (private: group member only) | Group detail + policy |
| PATCH | `/api/organizations/<id>/groups/<gid>` | group admin / org sys_admin | Update group name, visibility, policy |
| DELETE | `/api/organizations/<id>/groups/<gid>` | group admin / org sys_admin | Delete group |
| POST | `/api/organizations/<id>/groups/<gid>/join` | org member | Request to join group (sets status=pending) |
| DELETE | `/api/organizations/<id>/groups/<gid>/join` | pending member | Cancel own join request |
| GET | `/api/organizations/<id>/groups/<gid>/join-requests` | group admin | List pending join requests |
| GET | `/api/organizations/<id>/groups/<gid>/join-requests/count` | group admin | Count pending join requests |
| PATCH | `/api/organizations/<id>/groups/<gid>/join-requests/<uid>` | group admin | Approve or reject join request |
| GET | `/api/organizations/<id>/groups/<gid>/members` | group member | List group members |
| POST | `/api/organizations/<id>/groups/<gid>/members` | group admin / org sys_admin | Add org member to group |
| PATCH | `/api/organizations/<id>/groups/<gid>/members/<uid>` | group admin / org sys_admin | Change group member role; blocked if demoting the sole active `admin` away from `admin` (re-submitting `admin` is a no-op and always allowed) |
| DELETE | `/api/organizations/<id>/groups/<gid>/members/<uid>` | group admin / org sys_admin | Remove member from group; blocked if target is the sole active `admin`, or owns private notes in the group (no note titles returned — remover may lack visibility into them) |
| POST | `/api/organizations/<id>/groups/<gid>/leave` | group member | Leave group (self); blocked if caller is the sole active `admin`, or owns private notes (titles included — it's the caller's own data) |

Service functions live in `organization_service.py`, `group_service.py`, and `invitation_service.py` inside `app/api/organizations/`.

#### Note & Folder routes (`/api/organizations/<id>/groups/<gid>/...`)

All routes require `org:read` org-level permission plus the group-level permission shown below.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `.../notes` | `note:read` | List notes in group |
| POST | `.../notes` | `note:create` | Create note in group |
| GET | `.../notes/tags` | `note:read` | List tags in group |
| GET | `.../notes/<nid>` | `note:read` | Get note |
| PATCH | `.../notes/<nid>` | `note:edit` | Update note (incl. `is_private` flag) |
| DELETE | `.../notes/<nid>` | `note:delete` | Delete note |
| GET | `.../notes/<nid>/members` | `note:read` | List private note members |
| POST | `.../notes/<nid>/members` | note owner | Add member to private note |
| PATCH | `.../notes/<nid>/members/<uid>` | note owner | Change private note member role |
| DELETE | `.../notes/<nid>/members/<uid>` | note owner | Remove private note member |
| GET | `.../folders` | `note:read` | List folders in group |
| POST | `.../folders` | `note:create` | Create folder in group |
| PATCH | `.../folders/<fid>` | `note:edit` | Rename folder |
| DELETE | `.../folders/<fid>` | `note:delete` | Delete folder |

Route implementations live in `note_routes.py` and `folder_routes.py` inside `app/api/organizations/`.

## Phase 7: Onboarding Setup Wizard (done) / Audit Log & Advanced Policies (pending)

### Onboarding wizard (implemented, `9e63418`)

When a user registers an account themselves (i.e. not via an email invitation), `GET /api/auth/me` returns `needs_onboarding: true` (zero org memberships) and `/organizations` redirects them to `/onboarding` (`frontend/app/onboarding/page.tsx`). Users who accepted an invitation already belong to an org, so `needs_onboarding` is `false` and they skip straight to `/organizations`. Once the wizard finishes (or the user completes setup and later revisits `/organizations` directly), `needs_onboarding` is `false` and the redirect no longer fires.

`OnboardingWizard` (`frontend/components/onboarding/OnboardingWizard.tsx`) holds all form state client-side across 7 internal steps — `org-name → org-policy → org-invitations → group-prompt → group-name → group-policy → done` — grouped into 4 visible phases (組織設定 / 招待 / グループ設定 / 完了). The `group-*` steps are optional (skippable via `group-prompt`); nothing is sent to the backend until the final review screen's "始める" button, which then calls `POST /api/organizations` (+ policy), `POST /api/organizations/<id>/invitations` per invite row, and `POST /api/organizations/<id>/groups` (+ policy) if a first group was configured — then navigates to that group's note list, or to the org's group list if no group was created.

### Still pending

- Audit log
- Advanced org/group policies (beyond what `OrganizationPolicy`/`GroupPolicy` already cover)
