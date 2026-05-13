from flask import jsonify
from flask import request

from . import auth_bp
from app.extensions import db
from app.schema import RegistrationSchema
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


@auth_bp.route("/users", methods=["GET"])
def get_users():
    users = db.session.execute(db.select(User).order_by(User.id)).scalars()
    result = [{"username": user.username} for user in users]
    return jsonify(result)
