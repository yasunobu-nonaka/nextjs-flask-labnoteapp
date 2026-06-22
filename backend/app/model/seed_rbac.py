"""
RBACの初期データ（権限・ロール）のシード関数。

テスト用 conftest.py の db.create_all() 後と、
本番マイグレーションのデータ投入ステップから呼び出される。
既存データが存在する場合はスキップするため、冪等に実行できる。
"""

from app.extensions import db
from app.model.rbac import Permission, RoleGlobal, RoleLocal

# --- 権限定義 ---

# 組織レベルの権限（RoleGlobal で使用）
ORG_PERMISSIONS = [
    ("org:read",               "組織情報の閲覧"),
    ("org:edit",               "組織名・ポリシーの変更"),
    ("org:delete",             "組織の削除"),
    ("org:member_add",         "組織メンバーの追加"),
    ("org:member_remove",      "組織メンバーの削除"),
    ("org:member_role_assign", "組織メンバーのロール変更"),
    ("org:group_create",       "組織内グループの作成"),
    ("org:group_manage_any",   "任意グループの管理（組織管理者権限）"),
]

# グループレベルの権限（RoleLocal で使用）
GROUP_PERMISSIONS = [
    ("group:read",               "グループ情報の閲覧"),
    ("group:edit",               "グループ名・ポリシーの変更"),
    ("group:delete",             "グループの削除"),
    ("group:member_add",         "グループメンバーの追加"),
    ("group:member_remove",      "グループメンバーの削除"),
    ("group:member_role_assign", "グループメンバーのロール変更"),
    ("note:create",              "ノートの作成"),
    ("note:read",                "ノートの閲覧"),
    ("note:edit",                "ノートの編集"),
    ("note:delete",              "ノートの削除"),
]

# --- ロール定義 ---

# 組織ロール（RoleGlobal）と付与する権限コードのマッピング
ORG_ROLE_DEFINITIONS = {
    "owner": {
        "description": "組織の作成者。全権を持つ。",
        "permissions": [
            "org:read", "org:edit", "org:delete",
            "org:member_add", "org:member_remove", "org:member_role_assign",
            "org:group_create", "org:group_manage_any",
        ],
    },
    "sys_admin": {
        "description": "組織のシステム管理者。メンバー管理・設定変更・グループ管理が可能。",
        "permissions": [
            "org:read", "org:edit",
            "org:member_add", "org:member_remove", "org:member_role_assign",
            "org:group_create", "org:group_manage_any",
        ],
    },
    "user_admin": {
        "description": "ユーザー管理者。メンバーの追加・削除が可能。",
        "permissions": [
            "org:read",
            "org:member_add", "org:member_remove",
            "org:group_create",
        ],
    },
    "member": {
        "description": "一般メンバー。組織情報の閲覧とグループの作成が可能（ポリシー依存）。",
        "permissions": [
            "org:read",
            "org:group_create",
        ],
    },
}

# グループロール（RoleLocal）と付与する権限コードのマッピング
GROUP_ROLE_DEFINITIONS = {
    "admin": {
        "description": "グループ管理者。グループ設定・メンバー管理・ノート全操作が可能。",
        "permissions": [
            "group:read", "group:edit", "group:delete",
            "group:member_add", "group:member_remove", "group:member_role_assign",
            "note:create", "note:read", "note:edit", "note:delete",
        ],
    },
    "editor": {
        "description": "編集者。ノートの作成・編集・削除が可能。",
        "permissions": [
            "group:read",
            "note:create", "note:read", "note:edit", "note:delete",
        ],
    },
    "viewer": {
        "description": "閲覧者。ノートの閲覧のみ可能。",
        "permissions": [
            "group:read",
            "note:read",
        ],
    },
}


def seed_rbac() -> None:
    """権限とロールの初期データをDBに投入する。冪等（既存レコードはスキップ）。"""

    # --- Step 1: 権限（Permission）の作成 ---
    all_perm_defs = ORG_PERMISSIONS + GROUP_PERMISSIONS
    perm_by_code: dict[str, Permission] = {}

    for code, description in all_perm_defs:
        perm = db.session.execute(
            db.select(Permission).filter_by(code=code)
        ).scalar_one_or_none()
        if not perm:
            perm = Permission(code=code, description=description)
            db.session.add(perm)
        perm_by_code[code] = perm

    db.session.flush()  # Permission.id を確定させる

    # --- Step 2: 組織ロール（RoleGlobal）の作成 ---
    for role_name, defn in ORG_ROLE_DEFINITIONS.items():
        role = db.session.execute(
            db.select(RoleGlobal).filter_by(name=role_name)
        ).scalar_one_or_none()
        if not role:
            role = RoleGlobal(
                name=role_name,
                description=defn["description"],
                permissions=[perm_by_code[c] for c in defn["permissions"]],
            )
            db.session.add(role)

    # --- Step 3: グループロール（RoleLocal）の作成 ---
    for role_name, defn in GROUP_ROLE_DEFINITIONS.items():
        role = db.session.execute(
            db.select(RoleLocal).filter_by(name=role_name)
        ).scalar_one_or_none()
        if not role:
            role = RoleLocal(
                name=role_name,
                description=defn["description"],
                permissions=[perm_by_code[c] for c in defn["permissions"]],
            )
            db.session.add(role)

    db.session.commit()
