from marshmallow import Schema, fields, validate

# グループレベルの有効なロール値
GROUP_ROLES = ["admin", "editor", "viewer"]
# グループ参加方式の有効な値
GROUP_JOIN_METHODS = ["invite_only", "request", "open"]


class GroupCreateSchema(Schema):
    """グループ作成の入力スキーマ。"""

    name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=200, error="グループ名は1〜200文字で入力してください"),
        load_only=True,
    )
    is_private = fields.Bool(load_default=False, load_only=True)


class GroupPolicySchema(Schema):
    """グループポリシーのスキーマ（入出力兼用）。"""

    allow_private_notes = fields.Bool(load_default=True)
    join_method = fields.Str(
        load_default="invite_only",
        validate=validate.OneOf(GROUP_JOIN_METHODS, error="無効な値です"),
    )
    is_notes_visible_to_org = fields.Bool(load_default=False)


class GroupUpdateSchema(Schema):
    """グループ情報更新の入力スキーマ（名前・プライベート設定・ポリシー）。"""

    name = fields.Str(
        validate=validate.Length(min=1, max=200, error="グループ名は1〜200文字で入力してください"),
        load_only=True,
    )
    is_private = fields.Bool(load_only=True)
    policy = fields.Nested(GroupPolicySchema, load_only=True)


class GroupResponseSchema(Schema):
    """グループ情報のレスポンススキーマ。"""

    id = fields.Int(dump_only=True)
    organization_id = fields.Int(dump_only=True)
    name = fields.Str(dump_only=True)
    is_private = fields.Bool(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    created_by_user_id = fields.Int(dump_only=True)
    # リクエストユーザーのグループ内ロール（サービス側で付加するフィールド）
    role = fields.Str(dump_only=True)
    policy = fields.Nested(GroupPolicySchema, dump_only=True)


class GroupMemberResponseSchema(Schema):
    """グループメンバー情報のレスポンススキーマ。"""

    user_id = fields.Int(dump_only=True)
    group_id = fields.Int(dump_only=True)
    role = fields.Str(dump_only=True)
    joined_at = fields.DateTime(dump_only=True)
    # ユーザー情報（サービス側で付加）
    username = fields.Str(dump_only=True)
    email = fields.Str(dump_only=True)


class AddGroupMemberSchema(Schema):
    """グループメンバー追加の入力スキーマ。"""

    user_id = fields.Int(required=True, load_only=True)
    role = fields.Str(
        load_default="editor",
        validate=validate.OneOf(GROUP_ROLES, error="無効なロールです"),
        load_only=True,
    )


class UpdateGroupMemberRoleSchema(Schema):
    """グループメンバーのロール変更スキーマ。"""

    role = fields.Str(
        required=True,
        validate=validate.OneOf(GROUP_ROLES, error="無効なロールです"),
        load_only=True,
    )
