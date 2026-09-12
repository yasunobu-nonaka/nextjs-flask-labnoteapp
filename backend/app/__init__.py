from flask import Flask, jsonify

from app.api import api_bp
from app.config import config
from app.extensions import db, migrate, jwt, mail, cors, limiter
from app.model import User


def create_app(config_name="development"):
    app = Flask(__name__)

    # load configuration from config class
    app.config.from_object(config[config_name])

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    mail.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["FRONTEND_URL"]}})
    limiter.init_app(app)

    @jwt.user_identity_loader
    def user_identity_lookup(user):
        return str(user.id)

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return db.session.get(User, identity)

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return (
            jsonify(
                {
                    "message": "リクエストが多すぎます。しばらく待ってから再試行してください"
                }
            ),
            429,
        )

    @app.after_request
    def set_security_headers(response):
        # JSON APIとしての最低限の衛生管理用ヘッダー。
        # CSP等のブラウザ描画に関わるポリシーはHTMLを返すフロントエンド（Next.js）側で設定する。
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        return response

    app.register_blueprint(api_bp)

    return app
