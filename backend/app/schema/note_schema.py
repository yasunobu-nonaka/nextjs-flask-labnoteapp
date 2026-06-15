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


class NoteResponseSchema(Schema):
    id = fields.Int(dump_only=True)
    group_id = fields.Int(dump_only=True)
    created_by_user_id = fields.Int(dump_only=True)
    title = fields.Str(dump_only=True)
    content_md = fields.Str(dump_only=True)
    folder_id = fields.Int(dump_only=True, allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    tags = fields.Method("get_tags", dump_only=True)

    def get_tags(self, obj):
        return [tag.tagname for tag in obj.tags]
