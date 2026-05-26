import os
from urllib.parse import quote_plus


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "fallback-secret")
    DEBUG = False
    TESTING = False

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")

    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER")
    MAIL_MAX_EMAILS = None
    MAIL_ASCII_ATTACHMENTS = False

    # メール関連の共通設定
    MAIL_SUPPRESS_SEND = False  # メール送信を抑制するか（テスト用）

    # その他の共通設定
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 最大リクエストサイズ 16MB


class DevelopmentConfig(Config):
    DEBUG = True

    # パスワード内の特殊文字をエスケープする
    POSTGRES_PASSWORD = quote_plus(os.environ.get("POSTGRES_PASSWORD"))

    SQLALCHEMY_DATABASE_URI = f"postgresql://{os.environ.get('POSTGRES_USER')}:{POSTGRES_PASSWORD}@db:5432/{os.environ.get('POSTGRES_DB')}"

    # Flask-Mail
    MAIL_SERVER = os.environ.get("DEV_MAIL_SERVER")
    MAIL_PORT = os.environ.get("DEV_MAIL_PORT")
    MAIL_USERNAME = os.environ.get("DEV_MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("DEV_MAIL_PASSWORD")
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False

    # 開発環境の特殊設定
    MAIL_SUPPRESS_SEND = False  # Mailtrapには送信させる
    MAIL_DEBUG = True  # メール送信のデバッグ出力を有効化

    # Mailtrap API設定（テスト自動化用）
    MAILTRAP_API_TOKEN = os.environ.get("MAILTRAP_API_TOKEN")
    MAILTRAP_INBOX_ID = os.environ.get("MAILTRAP_INBOX_ID")


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///test.db"

    # テスト環境では実際のメール送信を抑制
    MAIL_SUPPRESS_SEND = True  # メールを実際には送信しない

    # ダミーのSMTP設定（実際には使われないが必須項目）
    MAIL_SERVER = "localhost"
    MAIL_PORT = 25
    MAIL_USE_TLS = False
    MAIL_USE_SSL = False
    MAIL_USERNAME = None
    MAIL_PASSWORD = None

    # メモリ上にメールを保持してテストで検証可能に
    MAIL_TESTING = True


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False

    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

    # パスワード内の特殊文字をエスケープする
    POSTGRES_PASSWORD = quote_plus(os.environ.get("POSTGRES_PASSWORD"))

    SQLALCHEMY_DATABASE_URI = f"postgresql://{os.environ.get('POSTGRES_USER')}:{POSTGRES_PASSWORD}@db:5432/{os.environ.get('POSTGRES_DB')}"

    # 本番環境用設定
    MAIL_DEFAULT_SENDER = os.environ.get(
        "PROD_MAIL_DEFAULT_SENDER", "contact@yourdomain.com"
    )
    MAIL_MAX_EMAILS = int(os.environ.get("MAIL_MAX_EMAILS", 100))  # 1回の送信上限

    # レート制限（メールスパム防止）
    RATELIMIT_ENABLED = True
    RATELIMIT_DEFAULT = "100/hour;10/minute"  # 例: 1時間に100件まで


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
