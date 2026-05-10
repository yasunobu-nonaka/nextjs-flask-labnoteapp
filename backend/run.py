from flask import Flask

from app.api import api_bp

app = Flask(__name__)
app.register_blueprint(api_bp)


if __name__ == "__main__":
    app.run(debug=True)
