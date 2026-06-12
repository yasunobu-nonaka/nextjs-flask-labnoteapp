from sqlalchemy import or_
from flask_jwt_extended import create_access_token, create_refresh_token

from app.extensions import db
from app.model import User
from app.api.auth.exception import UsernameAlreadyExistsError, EmailAlreadyExistsError


def get_user_by_username(username):
    user = db.session.execute(
        db.select(User).filter_by(username=username)
    ).scalar_one_or_none()

    return user


def get_user_by_email(email):
    user = db.session.execute(
        db.select(User).filter_by(email=email)
    ).scalar_one_or_none()

    return user


def get_user_by_username_or_email(identifier):
    user = db.session.execute(
        db.select(User).filter(
            or_(User.username == identifier, User.email == identifier)
        )
    ).scalar_one_or_none()

    return user


def register_user(user_input):
    username = user_input["username"]
    email = user_input["email"]
    password = user_input["password"]

    # ユーザー名の重複チェック
    existing_user_by_username = get_user_by_username(username)

    if existing_user_by_username:
        raise UsernameAlreadyExistsError()

    # メールアドレスの重複チェック
    existing_user_by_email = get_user_by_email(email)

    if existing_user_by_email:
        raise EmailAlreadyExistsError()

    # ユーザーモデル作成
    user = User(username=username, email=email)
    user.set_password(password=password)

    # ユーザー登録
    db.session.add(user)
    db.session.commit()

    return user


def verify_user(user):
    # ユーザーを認証済みに更新
    user.verified = True
    db.session.commit()

    return user


def check_password_and_get_tokens(user, password):
    # パスワード照合
    if user and user.check_password(password):
        # アクセストークンとリフレッシュトークンを発行
        access_token = create_access_token(identity=user)
        refresh_token = create_refresh_token(identity=user)
        return access_token, refresh_token

    return None, None


def update_user_password(user, new_password):
    user.set_password(new_password)
    db.session.commit()

    return user


def delete_user(user):
    db.session.delete(user)
    db.session.commit()
