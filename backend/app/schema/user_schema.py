import re

from marshmallow import (
    Schema,
    fields,
    validate,
    validates,
    validates_schema,
    ValidationError,
)


class RegistrationSchema(Schema):
    username = fields.Str(
        required=True,
        validate=validate.Length(
            min=4, max=100, error="ユーザー名は4文字以上100字以下にしてください"
        ),
        error_messages={"required": "ユーザー名を入力してください"},
    )
    email = fields.Email(
        required=True,
        validate=validate.Length(
            min=4, max=100, error="メールアドレスは4文字以上100字以下にしてください"
        ),
        error_messages={"required": "メールアドレスを入力してください"},
    )
    password = fields.Str(
        required=True,
        validate=validate.Length(
            min=12, max=64, error="パスワードは12文字以上64字以下にしてください"
        ),
        error_messages={"required": "パスワードを入力してください"},
        load_only=True,
    )
    confirm = fields.Str(
        required=True,
        validate=validate.Length(
            min=12, max=64, error="パスワードは12文字以上64字以下にしてください"
        ),
        error_messages={"required": "パスワード確認を入力してください"},
        load_only=True,
    )

    @validates_schema
    def validate_password(self, data, **kwargs):
        if data["password"] != data["confirm"]:
            raise ValidationError("パスワードが合致しません", "confirm")


class LoginSchema(Schema):
    identifier = fields.Str(
        required=True,
        validate=validate.Length(
            min=4,
            max=100,
        ),
        error_messages={
            "required": "ユーザー名またはメールアドレスを入力してください",
            "invalid": "ユーザー名またはメールアドレスは4文字以上100字以下にしてください",
        },
    )
    password = fields.Str(
        required=True,
        validate=validate.Length(
            min=12,
            max=64,
            error="パスワードは12文字以上64字以下にしてください",
        ),
        error_messages={"required": "パスワードを入力してください"},
        load_only=True,
    )

    # カスタムバリデーションで識別子の形式をチェック
    @validates("identifier")
    def validate_identifier(self, data, **kwargs):
        # 最低限のフォーマットチェック
        if len(data) < 4 or len(data) > 100:
            raise ValidationError(
                "ユーザー名またはメールアドレスは4文字以上100字以下にしてください"
            )

        # オプション: email形式かどうかで警告（エラーにはしない）
        if "@" in data:
            # 簡易emailバリデーション
            if not re.match(r"^[^@]+@[^@]+\.[^@]+$", data):
                raise ValidationError("Invalid email format")
