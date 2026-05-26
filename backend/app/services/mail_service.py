from app.extensions import mail
from flask_mail import Mail, Message


def send_welcome_email(user_email: str, username: str):
    msg = Message(
        subject=f"ノートアプリ登録完了",
        sender="noreply@example.com",
        recipients=[user_email],
    )
    msg.body = f"ようこそ{username}さん！ラボノートアプリへの登録が完了しました。"
    mail.send(msg)
