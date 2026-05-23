from flask import jsonify, request
from marshmallow import ValidationError

from . import auth_bp
from app.schema import RegistrationSchema, LoginSchema
from app.api.auth.user_service import (
    search_user_service,
    register_user_service,
    authenticate_user_and_get_token,
)

register_schema = RegistrationSchema()
login_schema = LoginSchema()


@auth_bp.route("/register", methods=["POST"])
def register():
    # 入力値受け取り
    user_input = request.get_json()

    # 入力のバリデーション
    try:
        validated_user_input = register_schema.load(user_input)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    username = validated_user_input["username"]
    password = validated_user_input["password"]

    # ユーザー名の重複チェック
    existing_user = search_user_service(username)

    if existing_user:
        return jsonify({"message": "Username already exists"}), 409

    # ユーザー登録
    user = register_user_service(username, password)

    return (
        jsonify({"message": "User registration success", "username": user.username}),
        200,
    )


@auth_bp.route("/login", methods=["POST"])
def login():
    # 入力値受け取り
    user_input = request.get_json()

    # 入力のバリデーション
    try:
        validated_user_input = login_schema.load(user_input)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    username = validated_user_input["username"]
    password = validated_user_input["password"]

    # ユーザー名で検索
    user = search_user_service(username)

    token_json = authenticate_user_and_get_token(user, password)

    if token_json is None:
        return jsonify({"message": "Username or Password did not match"}), 401

    return token_json
