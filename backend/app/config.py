import os
from urllib.parse import quote_plus


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "fallback-secret")
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class DevelopmentConfig(Config):
    DEBUG = True

    # パスワード内の特殊文字をエスケープする
    POSTGRES_PASSWORD = quote_plus(os.environ.get("POSTGRES_PASSWORD"))

    SQLALCHEMY_DATABASE_URI = f"postgresql://{os.environ.get('POSTGRES_USER')}:{POSTGRES_PASSWORD}@db:5432/{os.environ.get('POSTGRES_DB')}"


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False

    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"

    # パスワード内の特殊文字をエスケープする
    POSTGRES_PASSWORD = quote_plus(os.environ.get("POSTGRES_PASSWORD"))

    SQLALCHEMY_DATABASE_URI = f"postgresql://{os.environ.get('POSTGRES_USER')}:{POSTGRES_PASSWORD}@db:5432/{os.environ.get('POSTGRES_DB')}"


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
