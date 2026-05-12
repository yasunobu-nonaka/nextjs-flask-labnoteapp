from dotenv import load_dotenv

load_dotenv()

from app import create_app
import os

config_name = os.environ.get("FLASK_CONFIG", "development")
app = create_app(config_name)

if __name__ == "__main__":
    app.run(port=5000)
