from marshmallow import Schema, fields, validate, validates_schema, ValidationError


class RegistrationSchema(Schema):
    username = fields.Str(
        required=True,
        validate=validate.Length(
            min=4, max=100, error="ユーザー名は4文字以上100字以下にしてください"
        ),
    )
    password = fields.Str(
        required=True,
        validate=validate.Length(
            min=12, max=64, error="パスワードは12文字以上64字以下にしてください"
        ),
        load_only=True,
    )
    confirm = fields.Str(required=True, load_only=True)

    @validates_schema
    def validate_password(self, data, **kwargs):
        if data["password"] != data["confirm"]:
            raise ValidationError("パスワードが合致しません", "confirm")
