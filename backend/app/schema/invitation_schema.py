from marshmallow import Schema, fields, validate

# 招待で付与できる組織レベルのロール（owner は招待では付与しない）
INVITABLE_ORG_ROLES = ["sys_admin", "user_admin", "member"]


class InvitationCreateSchema(Schema):
    """招待作成の入力スキーマ。"""

    email = fields.Email(
        required=True,
        load_only=True,
        validate=validate.Length(
            min=4, max=100, error="メールアドレスは4文字以上100字以下にしてください"
        ),
        error_messages={
            "required": "メールアドレスは必須です",
            "invalid": "有効なメールアドレスを入力してください",
        },
    )
    role = fields.Str(
        load_default="member",
        validate=validate.OneOf(INVITABLE_ORG_ROLES, error="無効なロールです"),
        load_only=True,
    )


class InvitationResponseSchema(Schema):
    """招待情報のレスポンススキーマ。"""

    id = fields.Int(dump_only=True)
    token = fields.Str(dump_only=True)
    email = fields.Str(dump_only=True)
    organization_id = fields.Int(dump_only=True)
    # 組織名（サービス側で付加）
    organization_name = fields.Str(dump_only=True)
    # 招待者のユーザー名（サービス側で付加）
    invited_by_username = fields.Str(dump_only=True)
    role = fields.Str(dump_only=True)
    status = fields.Str(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    expires_at = fields.DateTime(dump_only=True)
