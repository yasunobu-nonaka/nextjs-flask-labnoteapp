from flask import jsonify
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.model import User


def search_user_service(username):
    """
    ユーザー存在確認
    """

    user = db.session.execute(
        db.select(User).filter_by(username=username)
    ).scalar_one_or_none()

    return user


def register_user_service(username, password):
    """
    ユーザー登録
    """

    user = User(username=username)

    # パスワードハッシュ化
    user.set_password(password)

    # ユーザー登録
    db.session.add(user)
    db.session.commit()

    return user


def authenticate_user_and_get_token(user, password):
    # パスワード照合
    if user and user.check_password(password):
        # JWTトークン発行
        access_token = create_access_token(identity=user)
        return jsonify(access_token=access_token)

    return None
