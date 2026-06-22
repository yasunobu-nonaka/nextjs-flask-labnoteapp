from marshmallow import Schema, fields, validate


class FolderCreateSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    parent_id = fields.Int(load_default=None, allow_none=True)


class FolderRenameSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=100))


class FolderResponseSchema(Schema):
    id = fields.Int(dump_only=True)
    group_id = fields.Int(dump_only=True)
    name = fields.Str(dump_only=True)
    parent_id = fields.Int(dump_only=True, allow_none=True)
