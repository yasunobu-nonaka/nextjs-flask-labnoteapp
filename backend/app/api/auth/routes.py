from flask import jsonify, request
from marshmallow import ValidationError

from . import auth_bp
from app.schema import RegistrationSchema, LoginSchema
from app.api.auth.auth_service import (
    get_user_by_username,
    register_user,
    authenticate_user_and_get_token,
)
from app.api.auth.exception import UsernameAlreadyExistsError

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

    # ユーザー登録
    try:
        user = register_user(
            validated_user_input["username"], validated_user_input["password"]
        )
    except UsernameAlreadyExistsError:
        return jsonify({"message": "Username already exists"}), 409

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
    user = get_user_by_username(username)

    access_token = authenticate_user_and_get_token(user, password)

    if access_token is None:
        return jsonify({"message": "Username or Password did not match"}), 401

    return jsonify(access_token=access_token)
