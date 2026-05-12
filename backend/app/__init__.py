from flask import Flask

from app.api import api_bp
from app.config import config
from app.extensions import db, migrate


def create_app(config_name="development"):
    app = Flask(__name__)

    # load configuration from config class
    app.config.from_object(config[config_name])

    db.init_app(app)
    migrate.init_app(app, db)

    app.register_blueprint(api_bp)

    return app
