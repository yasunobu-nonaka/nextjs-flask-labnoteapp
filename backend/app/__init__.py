from flask import Flask

from app.api import api_bp
from app.config import config
from app.extensions import db, migrate, jwt
from app.model import User


def create_app(config_name="development"):
    app = Flask(__name__)

    # load configuration from config class
    app.config.from_object(config[config_name])

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    @jwt.user_identity_loader
    def user_identity_lookup(user):
        return str(user.id)

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return User.query.filter_by(id=identity).one_or_none()

    app.register_blueprint(api_bp)

    return app
