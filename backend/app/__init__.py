from datetime import datetime, timezone

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

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(_jwt_header, jwt_data):
        """トークン発行時刻(iat)がユーザーのtokens_valid_afterより前なら失効済みとする。

        個別トークンをブロックリストに登録する方式ではなく、ユーザー単位で
        「この時刻より前に発行されたトークンは全部無効」という基準を持たせる
        ことで、ログアウト・パスワード変更時に発行済みの全トークン
        （盗まれた可能性のあるものも含む）を一括で失効させられるようにしている。
        """
        user = db.session.get(User, int(jwt_data["sub"]))
        if user is None or user.tokens_valid_after is None:
            return False
        issued_at = datetime.fromtimestamp(jwt_data["iat"], tz=timezone.utc)
        # SQLite（テスト環境）はtimezone-awareなdatetimeを保存してもnaiveで
        # 返してくるため、常にUTCとして扱って比較できるよう補正する
        # （常にUTCで書き込んでいるため補正して問題ない。他の場所の
        # created_at_jstプロパティと同じ対処）
        tokens_valid_after = user.tokens_valid_after
        if tokens_valid_after.tzinfo is None:
            tokens_valid_after = tokens_valid_after.replace(tzinfo=timezone.utc)
        return issued_at < tokens_valid_after

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
        # CSP・Permissions-Policy等のブラウザ描画に関わるポリシーはHTMLを返す
        # フロントエンド（Next.js）側で設定する。
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["Origin-Agent-Cluster"] = "?1"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        # ノート内容・メールアドレス等の機微なJSONを、ブラウザ/共有プロキシに
        # キャッシュさせない（共有端末での利用後にキャッシュから漏れるのを防ぐ）
        response.headers["Cache-Control"] = "no-store"
        return response

    app.register_blueprint(api_bp)

    return app
