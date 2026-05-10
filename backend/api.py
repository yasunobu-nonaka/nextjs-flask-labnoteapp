from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/")
def hello_world():
    return jsonify({"id": 1, "name": "kamesan"})


if __name__ == "__main__":
    app.run(debug=True)
