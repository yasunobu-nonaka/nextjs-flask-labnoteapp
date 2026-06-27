from marshmallow import Schema, fields, validate


class NoteCreateSchema(Schema):
    title = fields.Str(
        required=True, validate=validate.Length(min=1, max=200), load_only=True
    )
    content_md = fields.Str(
        required=True, validate=validate.Length(min=1), load_only=True
    )
    tags = fields.List(
        fields.Str(
            validate=validate.Length(
                min=1, max=20, error="タグ名は20文字以内で入力してください"
            ),
        ),
        required=False,
        load_default=list,
        validate=validate.Length(max=10, error="タグは最大10個までです"),
    )
    folder_id = fields.Int(load_default=None, allow_none=True)
    is_private = fields.Bool(load_default=False)


class PrivateNoteMemberSchema(Schema):
    """プライベートノートの共有メンバー情報スキーマ。"""
    user_id = fields.Int(dump_only=True)
    username = fields.Method("get_username", dump_only=True)
    role = fields.Str(dump_only=True)
    invited_at = fields.DateTime(dump_only=True)

    def get_username(self, obj):
        return obj.user.username if obj.user else None


class NoteResponseSchema(Schema):
    id = fields.Int(dump_only=True)
    group_id = fields.Int(dump_only=True)
    created_by_user_id = fields.Int(dump_only=True)
    title = fields.Str(dump_only=True)
    content_md = fields.Str(dump_only=True)
    folder_id = fields.Int(dump_only=True, allow_none=True)
    is_private = fields.Bool(dump_only=True)
    # is_owner はサービス側で note オブジェクトに動的に付与した属性を参照する
    is_owner = fields.Bool(dump_only=True)
    private_members = fields.List(
        fields.Nested(PrivateNoteMemberSchema), dump_only=True
    )
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    tags = fields.Method("get_tags", dump_only=True)

    def get_tags(self, obj):
        return [tag.tagname for tag in obj.tags]


class NoteShareSchema(Schema):
    """プライベートノートへのメンバー招待スキーマ。"""
    user_id = fields.Int(required=True)
    role = fields.Str(
        required=True,
        validate=validate.OneOf(["editor", "viewer"], error="role は editor または viewer のみ指定できます"),
    )


class NoteRoleUpdateSchema(Schema):
    """プライベートノートのメンバーロール変更スキーマ。"""
    role = fields.Str(
        required=True,
        validate=validate.OneOf(["editor", "viewer"], error="role は editor または viewer のみ指定できます"),
    )
