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

    app.register_blueprint(api_bp)

    return app
