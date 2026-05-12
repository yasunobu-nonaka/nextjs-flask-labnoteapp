from marshmallow import Schema, fields


class NoteSchema(Schema):
    id = fields.Int()
    user_id = fields.Int()
    title = fields.Str()
    content_md = fields.Str()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()
