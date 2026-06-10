from flask import jsonify, request
from marshmallow import ValidationError

from . import auth_bp
from app.schema import RegistrationSchema, LoginSchema, EmailSchema, PasswordResetSchema
from app.extensions import db
from app.services.mail_service import (
    send_verification_email,
    send_password_reset_email,
    generate_reset_password_token,
    verify_email_verification_token,
    verify_reset_password_token,
    hash_token,
)
from app.api.auth.auth_service import (
    get_user_by_username_or_email,
    get_user_by_email,
    register_user,
    verify_user,
    check_password_and_get_token,
    update_user_password,
    delete_user,
)
from app.api.auth.exception import UsernameAlreadyExistsError, EmailAlreadyExistsError

register_schema = RegistrationSchema()
login_schema = LoginSchema()
email_schema = EmailSchema()
password_reset_schema = PasswordResetSchema()

#########################################################
# ユーザー登録処理
#########################################################


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
    email = verify_email_verification_token(token)

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
    user_input = request.get_json()

    try:
        validated_user_input = email_schema.load(user_input)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    email = validated_user_input["email"]
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


#########################################################
# ログイン処理
#########################################################


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


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    # メールアドレスの存在を確認
    user_input = request.get_json()

    # 入力のバリデーション
    try:
        validated_user_input = email_schema.load(user_input)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    email = validated_user_input["email"]
    user = get_user_by_email(email)

    if not user:
        return (
            jsonify(
                {
                    "message": "パスワードリセット用のメールを送信しました（登録済みのメールアドレスの場合）"
                }
            ),
            200,
        )

    # トークンを生成してハッシュをDBに保存（一回限り使用のため）
    token = generate_reset_password_token(user.email)
    user.reset_token_hash = hash_token(token)
    db.session.commit()

    # トークン付きURLをメールで送付
    if send_password_reset_email(user.email, token):
        return (
            jsonify(
                {
                    "message": "パスワードリセット用のメールを送信しました。",
                    "username": user.username,
                }
            ),
            200,
        )
    else:
        return jsonify({"error": "パスワードリセット用メールの送信に失敗しました"}), 500


@auth_bp.route("/reset-password/<token>", methods=["GET"])
def verify_reset_password_token_endpoint(token):
    """
    リセットトークンの検証エンドポイント（GET）
    フロントエンドでフォームを表示する前にトークンの有効性を確認
    """
    email = verify_reset_password_token(token)

    if not email:
        return jsonify({"error": "リンクの有効期限が切れているか、無効です"}), 400

    user = get_user_by_email(email)

    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    # トークンが有効な場合、新しいパスワードを設定するための一時トークンを返す
    # 実際の実装では、フロントエンドにフォームを表示するための情報を返す
    return (
        jsonify(
            {
                "message": "トークンは有効です",
                "email": email,
                "token": token,  # 次のステップで使用
            }
        ),
        200,
    )


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    # 入力のバリデーション
    user_input = request.get_json()

    try:
        validated_user_input = password_reset_schema.load(user_input)
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    # トークン認証
    email = verify_reset_password_token(validated_user_input["token"])

    if not email:
        return jsonify({"error": "リンクの有効期限が切れているか、無効です"}), 400

    # ユーザー確認
    user = get_user_by_email(email)

    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404

    # トークンが使用済みまたは未発行の場合は拒否
    token = validated_user_input["token"]
    if user.reset_token_hash is None or user.reset_token_hash != hash_token(token):
        return jsonify({"error": "このリンクはすでに使用済みか無効です"}), 400

    # ハッシュをクリアしてパスワード更新（同一commitで反映）
    user.reset_token_hash = None
    update_user_password(user, validated_user_input["password"])

    return jsonify({"message": "パスワードを更新しました"}), 200


@auth_bp.route("/reset-password/validate-token", methods=["POST"])
def validate_reset_token():
    """
    トークンの有効性を確認するエンドポイント（POST版）
    フロントエンドでのリアルタイムバリデーション用
    """
    data = request.get_json()
    token = data.get("token")

    if not token:
        return jsonify({"error": "トークンが必要です"}), 400

    email = verify_reset_password_token(token)

    if not email:
        return (
            jsonify({"valid": False, "error": "無効または期限切れのトークンです"}),
            400,
        )

    user = get_user_by_email(email)

    if not user:
        return jsonify({"valid": False, "error": "ユーザーが見つかりません"}), 404

    return jsonify({"valid": True, "email": email}), 200
