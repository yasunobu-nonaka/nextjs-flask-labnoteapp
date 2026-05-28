from flask import jsonify, request
from marshmallow import ValidationError

from . import auth_bp
from app.schema import RegistrationSchema, LoginSchema
from app.services.mail_service import send_verification_email, verify_verification_token
from app.api.auth.auth_service import (
    get_user_by_username_or_email,
    get_user_by_email,
    register_user,
    verify_user,
    check_password_and_get_token,
    delete_user,
)
from app.api.auth.exception import UsernameAlreadyExistsError, EmailAlreadyExistsError

register_schema = RegistrationSchema()
login_schema = LoginSchema()


@auth_bp.route("/register", methods=["POST"])
def register():
    # 入力値受け取り
    user_input = request.get_json()

    # 入力のバリデーション
    try:
        validated_user_input = register_schema.load(user_input)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    # ユーザー登録
    try:
        user = register_user(validated_user_input)
    except UsernameAlreadyExistsError:
        return jsonify({"message": "ユーザー名はすでに存在します"}), 409
    except EmailAlreadyExistsError:
        return jsonify({"message": "メールアドレスはすでに存在します"}), 409

    # 確認メール送信
    if send_verification_email(user.email):
        return (
            jsonify(
                {
                    "message": "ユーザー登録が完了しました。確認メールを送信しました。",
                    "username": user.username,
                }
            ),
            201,
        )
    else:
        # メール送信失敗時はユーザーを削除（オプション）
        delete_user(user)
        return jsonify({"error": "確認メールの送信に失敗しました"}), 500


@auth_bp.route("/verify/<token>", methods=["GET"])
def verify_email(token):
    """メール認証エンドポイント"""
    # トークンを検証する
    email = verify_verification_token(token)

    if not email:
        return jsonify({"error": "リンクの有効期限が切れているか、無効です"}), 400

    # ユーザー確認
    user = get_user_by_email(email)

    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    if user.verified:
        return jsonify({"message": "このメールアドレスは既に認証済みです"}), 200

    # ユーザーを認証済みに更新
    verify_user(user)

    return jsonify({"message": "メールアドレスが確認されました！"}), 200


@auth_bp.route("/user/status", methods=["GET"])
def check_verification_status():
    """認証状態確認エンドポイント"""
    email = request.args.get("email")

    if not email:
        return jsonify({"error": "メールアドレスが必要です"}), 400

    user = get_user_by_email(email)

    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    return jsonify(
        {
            "email": user.email,
            "verified": user.verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    )


@auth_bp.route("/resend-verification", methods=["POST"])
def resend_verification():
    """認証メール再送信エンドポイント"""
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"error": "メールアドレスが必要です"}), 400

    user = get_user_by_email(email)

    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    if user.verified:
        return jsonify({"message": "このアカウントは既に認証済みです"}), 200

    # 認証メールを再送信
    if send_verification_email(email):
        return jsonify({"message": "確認メールを再送信しました"}), 200
    else:
        return jsonify({"error": "メール送信に失敗しました"}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    # 入力値受け取り
    user_input = request.get_json()

    # 入力のバリデーション
    try:
        validated_user_input = login_schema.load(user_input)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    identifier = validated_user_input["identifier"]
    password = validated_user_input["password"]

    # ユーザー名で検索
    user = get_user_by_username_or_email(identifier)

    access_token = check_password_and_get_token(user, password)

    if access_token is None:
        return jsonify({"message": "Username or Password did not match"}), 401

    return jsonify(access_token=access_token)
