from flask import render_template
from flask_mail import Message
import hashlib
import logging
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask import current_app, url_for

from app.extensions import mail

# ロギングの設定
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


def generate_email_verification_token(email):
    """メール認証用のトークンを生成"""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    return serializer.dumps(email, salt="email-verification")


def generate_reset_password_token(email):
    """パスワードリセット用のトークンを生成"""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    return serializer.dumps(email, salt="password-reset")


def hash_token(token: str) -> str:
    """トークンを SHA-256 でハッシュ化して返す"""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_email_verification_token(token, expiration=1800):
    """トークンを検証し、有効な場合はメールアドレスを返す"""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        email = serializer.loads(token, salt="email-verification", max_age=expiration)
        return email
    except SignatureExpired:
        logging.warning("Verification token expired")
        return None
    except BadSignature:
        logging.warning("Invalid verification token")
        return None


def verify_reset_password_token(token, expiration=1800):
    """パスワードリセットトークンを検証"""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        email = serializer.loads(token, salt="password-reset", max_age=expiration)
        return email
    except (SignatureExpired, BadSignature):
        return None


def send_verification_email(user_email):
    """認証メールを送信"""
    try:
        token = generate_email_verification_token(user_email)
        verify_url = f"{current_app.config['FRONTEND_URL']}/verify-email/{token}"
        html_body = render_template(
            "email/verification_email.html", verify_url=verify_url
        )

        msg = Message(
            subject="メールアドレスの確認",
            sender="noreply@example.com",
            recipients=[user_email],
            html=html_body,
            body=f"以下のリンクをコピーしてブラウザに貼り付けてください：\n\n{verify_url}\n\nこのリンクの有効期限は1時間です。",
        )

        mail.send(msg)
        logging.info(f"Verification email sent to {user_email}")
        return True

    except Exception as e:
        logging.error(f"Failed to send email to {user_email}: {str(e)}")
        return False


def generate_email_change_token(email):
    """メールアドレス変更確認用のトークンを生成する。payload は新メールアドレス。"""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    return serializer.dumps(email, salt="email-change")


def verify_email_change_token(token, expiration=1800):
    """メールアドレス変更確認トークンを検証し、有効な場合は新メールアドレスを返す。"""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        email = serializer.loads(token, salt="email-change", max_age=expiration)
        return email
    except SignatureExpired:
        logging.warning("Email change token expired")
        return None
    except BadSignature:
        logging.warning("Invalid email change token")
        return None


def send_email_change_confirmation(pending_email, token):
    """メールアドレス変更の確認メールを新メールアドレス宛に送信する。"""
    try:
        verify_url = f"{current_app.config['FRONTEND_URL']}/verify-email-change/{token}"
        html_body = render_template(
            "email/email_change_confirmation.html", verify_url=verify_url
        )
        msg = Message(
            subject="メールアドレス変更の確認",
            sender="noreply@example.com",
            recipients=[pending_email],
            html=html_body,
            body=f"以下のリンクをクリックしてメールアドレスの変更を確定してください：\n\n{verify_url}\n\nこのリンクの有効期限は30分です。",
        )
        mail.send(msg)
        logging.info(f"Email change confirmation sent to {pending_email}")
        return True
    except Exception as e:
        logging.error(
            f"Failed to send email change confirmation to {pending_email}: {str(e)}"
        )
        return False


def send_password_reset_email(user_email, token):
    try:
        verify_url = url_for("api.auth.reset_password", token=token, _external=True)
        html_body = render_template("email/reset_password.html", verify_url=verify_url)

        msg = Message(
            subject="メールアドレスの確認",
            sender="noreply@example.com",
            recipients=[user_email],
            html=html_body,
            body=f"以下のリンクをコピーしてブラウザに貼り付けてください：\n\n{verify_url}\n\nこのリンクの有効期限は1時間です。",
        )

        mail.send(msg)
        logging.info(f"Verification email sent to {user_email}")
        return True

    except Exception as e:
        logging.error(f"Failed to send email to {user_email}: {str(e)}")
        return False
