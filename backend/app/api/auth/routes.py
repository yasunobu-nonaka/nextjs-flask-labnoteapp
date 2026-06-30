from flask import jsonify, request
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    create_access_token,
    current_user,
)
from marshmallow import ValidationError

from . import auth_bp
from app.schema import (
    RegistrationSchema,
    LoginSchema,
    EmailSchema,
    PasswordResetSchema,
    UsernameUpdateSchema,
    EmailUpdateSchema,
    PasswordChangeSchema,
    PasswordVerifySchema,
)
from app.extensions import db
from app.services.mail_service import (
    send_verification_email,
    send_password_reset_email,
    generate_reset_password_token,
    verify_email_verification_token,
    verify_reset_password_token,
    hash_token,
    generate_email_change_token,
    verify_email_change_token,
    send_email_change_confirmation,
)
from app.api.auth.auth_service import (
    get_user_by_username_or_email,
    get_user_by_email,
    get_user_by_username,
    get_user_by_pending_email,
    register_user,
    verify_user,
    check_password_and_get_tokens,
    update_username,
    initiate_email_change,
    confirm_email_change,
    update_user_password,
    delete_user,
)
from app.api.auth.exception import UsernameAlreadyExistsError, EmailAlreadyExistsError

register_schema = RegistrationSchema()
login_schema = LoginSchema()
email_schema = EmailSchema()
password_reset_schema = PasswordResetSchema()
username_update_schema = UsernameUpdateSchema()
email_update_schema = EmailUpdateSchema()
password_change_schema = PasswordChangeSchema()
password_verify_schema = PasswordVerifySchema()

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


#########################################################
# メール認証処理
#########################################################


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
# ログイン / トークン管理
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

    access_token, refresh_token = check_password_and_get_tokens(user, password)

    if access_token is None:
        return jsonify({"message": "Username or Password did not match"}), 401

    return jsonify(access_token=access_token, refresh_token=refresh_token)


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """リフレッシュトークンを使って新しいアクセストークンを発行する"""
    from app.extensions import db
    from app.model import User

    # get_jwt_identity() は user_identity_loader が返した文字列（str(user.id)）を返す
    # create_access_token には User オブジェクトを渡す必要があるため、DBから引き直す
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))
    if not user:
        return jsonify({"message": "ユーザーが見つかりません"}), 404
    new_access_token = create_access_token(identity=user)
    return jsonify(access_token=new_access_token)


#########################################################
# アカウント管理
#########################################################


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    """現在のログインユーザーの情報を返す。

    needs_onboarding は organization_memberships が 0 件のとき true。
    招待経由で参加済みのユーザーは既に 1 件以上あるため false になる。
    """
    return jsonify(
        {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "needs_onboarding": len(current_user.organization_memberships) == 0,
        }
    )


@auth_bp.route("/me", methods=["DELETE"])
@jwt_required()
def delete_me():
    """ログイン中のユーザーのアカウントを削除する。

    以下の条件に該当する場合は 409 を返して削除を拒否する:
    - 組織で通常メンバー以外のロール (owner / sys_admin / user_admin) を持つ
    - グループの管理者 (admin) である
    - プライベートノートのオーナーである
    - 作成したノートまたはフォルダが残っている (FK 制約のため事前に削除が必要)
    """
    from app.model import (
        OrganizationMember,
        GroupMember,
        Note,
        Folder,
        PrivateNoteMember,
    )

    # 1. 組織ロールチェック: 通常メンバー以外はブロック
    for m in current_user.organization_memberships:
        if m.role.name == "owner":
            # オーナーは移譲または組織削除が必要（ロール変更では解決できない）
            return (
                jsonify(
                    {
                        "message": f"組織「{m.organization.name}」のオーナーです。"
                        "先に別のメンバーにオーナーを移譲するか、組織を削除してからアカウントを削除してください。"
                    }
                ),
                409,
            )
        elif m.role.name != "member":
            return (
                jsonify(
                    {
                        "message": f"組織「{m.organization.name}」で「{m.role.name}」ロールを持っています。"
                        "ロールを変更してからアカウントを削除してください。"
                    }
                ),
                409,
            )

    # 2. グループ管理者チェック: admin はブロック
    for m in current_user.group_memberships:
        if m.role.name == "admin":
            return (
                jsonify(
                    {
                        "message": f"グループ「{m.group.name}」の管理者です。"
                        "管理者を変更してからアカウントを削除してください。"
                    }
                ),
                409,
            )

    # 3. プライベートノートのオーナーチェック
    if (
        db.session.query(Note)
        .filter(
            Note.created_by_user_id == current_user.id,
            Note.is_private.is_(True),
        )
        .first()
    ):
        return (
            jsonify(
                {
                    "message": "プライベートノートのオーナーです。"
                    "プライベートノートを移譲または削除してからアカウントを削除してください。"
                }
            ),
            409,
        )

    # 4. 通常ノート・フォルダの FK 制約: 先に削除してもらう必要がある
    if (
        db.session.query(Note)
        .filter(Note.created_by_user_id == current_user.id)
        .first()
    ):
        return (
            jsonify(
                {
                    "message": "作成したノートが残っています。先にノートを削除してからアカウントを削除してください。"
                }
            ),
            409,
        )

    if (
        db.session.query(Folder)
        .filter(Folder.created_by_user_id == current_user.id)
        .first()
    ):
        return (
            jsonify(
                {
                    "message": "作成したフォルダが残っています。先にフォルダを削除してからアカウントを削除してください。"
                }
            ),
            409,
        )

    # すべてのチェックを通過: メンバーシップと共有プライベートノートのメンバー記録を削除してからユーザーを削除する
    db.session.query(PrivateNoteMember).filter(
        PrivateNoteMember.user_id == current_user.id
    ).delete()
    db.session.query(GroupMember).filter(
        GroupMember.user_id == current_user.id
    ).delete()
    db.session.query(OrganizationMember).filter(
        OrganizationMember.user_id == current_user.id
    ).delete()
    # バルク削除後にセッションをリセットして、残留した関連オブジェクトが
    # delete_user() 内の db.session.delete(user) に干渉しないようにする
    db.session.expire_all()
    delete_user(current_user)
    return "", 204


@auth_bp.route("/me/username", methods=["PATCH"])
@jwt_required()
def update_me_username():
    """ログイン中のユーザーのユーザー名を変更する"""
    try:
        data = username_update_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    new_username = data["username"]

    # 現在と同じ名前はそのまま返す
    if new_username == current_user.username:
        return jsonify({"username": current_user.username}), 200

    # 重複チェック
    if get_user_by_username(new_username):
        return jsonify({"message": "このユーザー名はすでに使われています"}), 409

    update_username(current_user, new_username)
    return jsonify({"username": current_user.username}), 200


@auth_bp.route("/me/password/verify", methods=["POST"])
@jwt_required()
def verify_me_password():
    """パスワード変更フロー step 1: 現在のパスワードが正しいか検証する"""
    try:
        data = password_verify_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    if not current_user.check_password(data["current_password"]):
        return jsonify({"message": "現在のパスワードが正しくありません"}), 401

    return jsonify({"message": "ok"}), 200


@auth_bp.route("/me/password", methods=["PATCH"])
@jwt_required()
def update_me_password():
    """ログイン中のユーザーのパスワードを変更する"""
    try:
        data = password_change_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    if not current_user.check_password(data["current_password"]):
        return jsonify({"message": "現在のパスワードが正しくありません"}), 401

    update_user_password(current_user, data["password"])
    return jsonify({"message": "パスワードを変更しました"}), 200


@auth_bp.route("/me/email", methods=["PATCH"])
@jwt_required()
def update_me_email():
    """ログイン中のユーザーのメールアドレス変更を開始する（確認メール送信）"""
    try:
        data = email_update_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"message": "validation error", "errors": err.messages}), 400

    new_email = data["email"]

    if new_email == current_user.email:
        return jsonify({"message": "現在と同じメールアドレスです"}), 400

    if get_user_by_email(new_email):
        return jsonify({"message": "このメールアドレスはすでに使われています"}), 409

    initiate_email_change(current_user, new_email)

    token = generate_email_change_token(new_email)
    if send_email_change_confirmation(new_email, token):
        return (
            jsonify(
                {
                    "message": "確認メールを送信しました。メールのリンクをクリックして変更を確定してください。"
                }
            ),
            200,
        )

    # メール送信失敗時は pending_email をクリアして元に戻す
    current_user.pending_email = None
    db.session.commit()
    return jsonify({"error": "確認メールの送信に失敗しました"}), 500


@auth_bp.route("/verify-email-change/<token>", methods=["GET"])
def verify_email_change(token):
    """メールアドレス変更の確認トークンを検証し、変更を確定する"""
    new_email = verify_email_change_token(token)
    if not new_email:
        return jsonify({"error": "リンクの有効期限が切れているか、無効です"}), 400

    user = get_user_by_pending_email(new_email)
    if not user:
        return (
            jsonify({"error": "変更申請が見つかりません。再度変更をお試しください。"}),
            404,
        )

    # 確認リンクを踏む間に別ユーザーが同じアドレスを登録していないか最終チェック
    if get_user_by_email(new_email):
        return (
            jsonify(
                {"error": "このメールアドレスはすでに別のアカウントで使われています"}
            ),
            409,
        )

    confirm_email_change(user)
    return jsonify({"message": "メールアドレスを変更しました"}), 200


#########################################################
# パスワードリセット処理
#########################################################


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
