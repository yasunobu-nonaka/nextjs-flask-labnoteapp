from marshmallow import Schema, fields, validate

# 組織レベルの有効なロール値
ORG_ROLES = ["owner", "sys_admin", "user_admin", "member"]
# グループ作成権限の有効な値
WHO_CAN_CREATE_GROUPS = ["sys_admin_only", "user_admin", "member", "all"]
# グループ参加方式の有効な値
JOIN_METHODS = ["invite_only", "request", "open"]


class OrganizationCreateSchema(Schema):
    """組織作成の入力スキーマ。"""

    name = fields.Str(
        required=True,
        validate=validate.Length(min=1, max=200, error="組織名は1〜200文字で入力してください"),
        load_only=True,
    )


class OrganizationPolicySchema(Schema):
    """組織ポリシーのスキーマ（入出力兼用）。"""

    allow_private_groups = fields.Bool(load_default=True)
    allow_private_notes = fields.Bool(load_default=True)
    who_can_create_groups = fields.Str(
        load_default="member",
        validate=validate.OneOf(WHO_CAN_CREATE_GROUPS, error="無効な値です"),
    )
    default_join_method = fields.Str(
        load_default="invite_only",
        validate=validate.OneOf(JOIN_METHODS, error="無効な値です"),
    )


class OrganizationUpdateSchema(Schema):
    """組織情報更新の入力スキーマ（名前・ポリシー）。"""

    name = fields.Str(
        validate=validate.Length(min=1, max=200, error="組織名は1〜200文字で入力してください"),
        load_only=True,
    )
    policy = fields.Nested(OrganizationPolicySchema, load_only=True)


class OrganizationResponseSchema(Schema):
    """組織情報のレスポンススキーマ。"""

    id = fields.Int(dump_only=True)
    name = fields.Str(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    created_by_user_id = fields.Int(dump_only=True)
    # リクエストユーザーの組織内ロール（サービス側で付加するフィールド）
    role = fields.Str(dump_only=True)
    policy = fields.Nested(OrganizationPolicySchema, dump_only=True)


class OrganizationMemberResponseSchema(Schema):
    """組織メンバー情報のレスポンススキーマ。"""

    user_id = fields.Int(dump_only=True)
    organization_id = fields.Int(dump_only=True)
    role = fields.Str(dump_only=True)
    joined_at = fields.DateTime(dump_only=True)
    # ユーザー情報（サービス側で付加）
    username = fields.Str(dump_only=True)
    email = fields.Str(dump_only=True)


class AddOrgMemberSchema(Schema):
    """組織メンバー追加の入力スキーマ。"""

    user_id = fields.Int(required=True, load_only=True)
    role = fields.Str(
        load_default="member",
        validate=validate.OneOf(
            [r for r in ORG_ROLES if r != "owner"],
            error="無効なロールです",
        ),
        load_only=True,
    )


class UpdateOrgMemberRoleSchema(Schema):
    """組織メンバーのロール変更スキーマ。"""

    role = fields.Str(
        required=True,
        validate=validate.OneOf(
            [r for r in ORG_ROLES if r != "owner"],
            error="無効なロールです",
        ),
        load_only=True,
    )
