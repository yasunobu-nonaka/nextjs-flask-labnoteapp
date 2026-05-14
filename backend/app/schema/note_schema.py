from marshmallow import Schema, fields, validate


class NoteCreateSchema(Schema):
    title = fields.Str(
        required=True, validate=validate.Length(min=1, max=200), load_only=True
    )
    content_md = fields.Str(
        required=True, validate=validate.Length(min=1), load_only=True
    )


class NoteResponseSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(dump_only=True)
    title = fields.Str(dump_only=True)
    content_md = fields.Str(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
