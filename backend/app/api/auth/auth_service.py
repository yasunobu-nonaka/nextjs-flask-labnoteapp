from flask_jwt_extended import create_access_token

from app.extensions import db
from app.model import User
from app.api.auth.exception import UsernameAlreadyExistsError


def get_user_by_username(username):
    user = db.session.execute(
        db.select(User).filter_by(username=username)
    ).scalar_one_or_none()

    return user


def register_user(username, password):
    # ユーザー名の重複チェック
    existing_user = get_user_by_username(username)

    if existing_user:
        raise UsernameAlreadyExistsError()

    # ユーザーモデル作成
    user = User(username=username)
    user.set_password(password)

    # ユーザー登録
    db.session.add(user)
    db.session.commit()

    return user


def authenticate_user_and_get_token(user, password):
    # パスワード照合
    if user and user.check_password(password):
        # JWTトークン発行
        return create_access_token(identity=user)

    return None
