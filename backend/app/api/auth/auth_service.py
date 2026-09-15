from datetime import datetime, timezone

from sqlalchemy import or_
from flask_jwt_extended import create_access_token, create_refresh_token
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db
from app.model import User
from app.api.auth.exception import UsernameAlreadyExistsError, EmailAlreadyExistsError

# ユーザーが存在しない場合でも check_password_hash を1回実行するためのダミーハッシュ。
# 実在するユーザーへのログイン試行（ハッシュ比較あり）と存在しないユーザーへの
# 試行（比較なしで即失敗）とで応答時間に差が出ると、その差を測定するだけで
# ユーザー名/メールアドレスの登録有無が推測できてしまう（タイミング攻撃）。
# モジュール読み込み時に一度だけ生成し、値そのものに意味はない。
_DUMMY_PASSWORD_HASH = generate_password_hash("dummy-password-for-timing-safety")


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
    # パスワード照合。user が None の場合もダミーハッシュとの比較を行い、
    # 存在するユーザーへの試行と同じ処理コストにする（タイミング攻撃対策）。
    if user:
        password_ok = user.check_password(password)
    else:
        check_password_hash(_DUMMY_PASSWORD_HASH, password)
        password_ok = False

    if password_ok:
        # アクセストークンとリフレッシュトークンを発行
        access_token = create_access_token(identity=user)
        refresh_token = create_refresh_token(identity=user)
        return access_token, refresh_token

    return None, None


def get_user_by_pending_email(email):
    """pending_email が一致するユーザーを返す。メール変更確定時のユーザー特定に使う。"""
    user = db.session.execute(
        db.select(User).filter_by(pending_email=email)
    ).scalar_one_or_none()
    return user


def initiate_email_change(user, new_email):
    """pending_email に新メールアドレスを保存する。呼び出し前に重複チェックを済ませること。"""
    user.pending_email = new_email
    db.session.commit()
    return user


def confirm_email_change(user):
    """pending_email を本メールアドレスに昇格し、pending_email をクリアする。"""
    user.email = user.pending_email
    user.pending_email = None
    db.session.commit()
    return user


def update_username(user, new_username):
    """ユーザー名を変更する。呼び出し前に重複チェックを済ませること。"""
    user.username = new_username
    db.session.commit()
    return user


def update_user_password(user, new_password):
    user.set_password(new_password)
    # パスワード変更時点までに発行された全トークンを失効させる。
    # /me/password（認証済み変更）・/reset-password（トークンによるリセット）の
    # どちらの経路でもここを通るため、両方で自動的に保護される。
    user.tokens_valid_after = datetime.now(timezone.utc)
    db.session.commit()

    return user


def delete_user(user):
    db.session.delete(user)
    db.session.commit()
