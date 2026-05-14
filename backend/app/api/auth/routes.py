from flask import jsonify
from flask import request
from flask_jwt_extended import create_access_token

from . import auth_bp
from app.extensions import db
from app.schema import RegistrationSchema, LoginSchema
from app.model import User


@auth_bp.route("/register", methods=["POST"])
def register():
    # 入力値受け取り
    user_input = request.get_json()

    # バリデーション
    schema = RegistrationSchema()
    validated_user_input = schema.load(user_input)

    # ユーザーモデル定義
    user = User(username=validated_user_input["username"])

    # パスワードハッシュ化
    user.set_password(validated_user_input["password"])

    # ユーザー登録
    db.session.add(user)
    db.session.commit()

    return (
        jsonify({"message": "User registration success", "username": user.username}),
        200,
    )


@auth_bp.route("/login", methods=["POST"])
def login():
    # 入力値受け取り
    user_input = request.get_json()

    # バリデーション
    schema = LoginSchema()
    validated_user_input = schema.load(user_input)

    username = validated_user_input["username"]
    password = validated_user_input["password"]

    # ユーザー名で検索
    user = db.session.execute(
        db.select(User).filter_by(username=username)
    ).scalar_one_or_none()

    # パスワード照合
    if user and user.check_password(password):
        # JWTトークン発行
        access_token = create_access_token(identity=user)
        return jsonify(access_token=access_token)

    return jsonify({"message": "Username or Password did not match"}), 401


@auth_bp.route("/users", methods=["GET"])
def get_users():
    users = db.session.execute(db.select(User).order_by(User.id)).scalars()
    result = [{"username": user.username} for user in users]
    return jsonify(result)
