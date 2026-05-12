from marshmallow import Schema, fields, validate


class NoteCreateSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    content_md = fields.Str(required=True, validate=validate.Length(min=1))


class NoteResponseSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int()
    title = fields.Str()
    content_md = fields.Str()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
