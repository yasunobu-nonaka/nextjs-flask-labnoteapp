from sqlalchemy import func, or_, and_, exists
from sqlalchemy.orm import selectinload

from flask import abort

from app.extensions import db
from app.model import Note, Tag, PrivateNoteMember
from app.model.group import Group, GroupPolicy
from app.api.notes.tag_service import get_or_create_tags


def _private_access_filter(current_user_id: int):
    """プライベートノートのアクセス可否を判定するSQLフィルター条件を返す。

    以下のいずれかを満たすノートのみ返す:
    1. 公開ノート（is_private=False）
    2. 自分が作成したノート
    3. PrivateNoteMember に登録されているノート
    """
    return or_(
        Note.is_private == False,  # noqa: E712
        Note.created_by_user_id == current_user_id,
        exists().where(
            and_(
                PrivateNoteMember.note_id == Note.id,
                PrivateNoteMember.user_id == current_user_id,
            )
        ),
    )


def _set_is_owner(note: Note, current_user_id: int) -> None:
    """スキーマが参照する is_owner 属性をノートオブジェクトに動的にセットする。"""
    owner_member = next(
        (
            m
            for m in note.private_members
            if m.user_id == current_user_id and m.role == "owner"
        ),
        None,
    )
    note.is_owner = owner_member is not None


def get_notes_service(
    group_id,
    query_word=None,
    tag_names=None,
    folder_id=None,
    page=1,
    per_page=10,
    current_user_id=None,
):
    """ノート一覧取得。プライベートノートは作成者・共有メンバーのみに返す。"""

    base_filter = Note.group_id == group_id
    access_filter = _private_access_filter(current_user_id) if current_user_id else True

    query = (
        db.select(Note)
        .filter(base_filter, access_filter)
        .options(selectinload(Note.tags), selectinload(Note.private_members))
    )
    count_query = db.select(func.count(Note.id)).filter(base_filter, access_filter)

    if query_word:
        query = query.filter(Note.title.ilike(f"%{query_word}%"))
        count_query = count_query.filter(Note.title.ilike(f"%{query_word}%"))

    for tag_name in tag_names or []:
        query = query.filter(Note.tags.any(Tag.tagname == tag_name))
        count_query = count_query.filter(Note.tags.any(Tag.tagname == tag_name))

    # "null" センチネルはフォルダー未所属ノートのみを返す
    if folder_id == "null":
        query = query.filter(Note.folder_id.is_(None))
        count_query = count_query.filter(Note.folder_id.is_(None))
    elif folder_id is not None:
        query = query.filter(Note.folder_id == folder_id)
        count_query = count_query.filter(Note.folder_id == folder_id)

    total = db.session.execute(count_query).scalar_one()
    offset = (page - 1) * per_page
    notes = (
        db.session.execute(query.order_by(Note.id).offset(offset).limit(per_page))
        .scalars()
        .all()
    )

    if current_user_id is not None:
        for note in notes:
            _set_is_owner(note, current_user_id)

    return notes, total


def get_note_or_404_service(note_id, group_id, current_user_id=None):
    """単一ノート取得。プライベートノートのアクセス制御も行う。"""

    note = db.one_or_404(
        db.select(Note)
        .filter_by(id=note_id, group_id=group_id)
        .options(selectinload(Note.tags), selectinload(Note.private_members))
    )

    if note.is_private and current_user_id is not None:
        allowed_user_ids = {m.user_id for m in note.private_members}
        if (
            current_user_id != note.created_by_user_id
            and current_user_id not in allowed_user_ids
        ):
            # 存在を隠すために 404 を返す
            abort(404)

    if current_user_id is not None:
        _set_is_owner(note, current_user_id)

    return note


def create_note_service(data, group_id, user_id):
    """ノート作成。is_private=True の場合は作成者を owner として PrivateNoteMember に登録する。"""

    is_private = data.get("is_private", False)

    # グループポリシーで非公開ノートが許可されているか確認する
    if is_private:
        policy = db.session.execute(
            db.select(GroupPolicy).filter_by(group_id=group_id)
        ).scalar_one_or_none()
        if policy and not policy.allow_private_notes:
            abort(403, description="このグループでは非公開ノートを作成できません")

    note = Note(
        group_id=group_id,
        created_by_user_id=user_id,
        title=data["title"],
        content_md=data["content_md"],
        folder_id=data.get("folder_id"),
        is_private=is_private,
    )

    tags = get_or_create_tags(data.get("tags", []), group_id)
    note.tags.extend(tags)

    db.session.add(note)

    if is_private:
        # note.id を確定させてから PrivateNoteMember を追加する
        db.session.flush()
        db.session.add(
            PrivateNoteMember(note_id=note.id, user_id=user_id, role="owner")
        )

    db.session.commit()

    # private_members をロードして is_owner をセットする
    db.session.refresh(note)
    db.session.execute(
        db.select(PrivateNoteMember).filter_by(note_id=note.id)
    ).scalars().all()
    note.is_owner = is_private

    return note


def update_note_service(note, data, group_id, current_user_id=None):
    """ノート更新。プライベートノートは owner/editor のみ編集可。

    public → private への変換は作成者のみ実行できる。
    private → public への変換はオーナーのみ実行できる。
    変換時に PrivateNoteMember に owner が未登録なら作成者を owner として登録する。
    """

    # public → private への変換は作成者のみ許可する
    if data.get("is_private") and not note.is_private:
        if current_user_id is not None and current_user_id != note.created_by_user_id:
            abort(403, description="非公開への変更はノートの作成者のみ行えます")

    # private → public への変換はオーナーのみ許可する
    if "is_private" in data and not data["is_private"] and note.is_private:
        if current_user_id is not None:
            owner = next(
                (m for m in note.private_members if m.user_id == current_user_id and m.role == "owner"),
                None,
            )
            if owner is None:
                abort(403, description="公開への変更はオーナーのみ行えます")

    if note.is_private and current_user_id is not None:
        member = next(
            (m for m in note.private_members if m.user_id == current_user_id),
            None,
        )
        if member is None:
            abort(404)
        if member.role not in ("owner", "editor"):
            abort(403, description="閲覧権限のみです。編集権限がありません")

    if "title" in data:
        note.title = data["title"]

    if "content_md" in data:
        note.content_md = data["content_md"]

    if "tags" in data:
        tags = get_or_create_tags(data["tags"], group_id)
        note.tags = tags

    if "folder_id" in data:
        note.folder_id = data["folder_id"]

    if "is_private" in data:
        note.is_private = data["is_private"]
        # public → private への変換時に owner が未登録なら作成者を owner として追加する
        if note.is_private and current_user_id is not None:
            existing_owner = next(
                (m for m in note.private_members if m.role == "owner"),
                None,
            )
            if existing_owner is None:
                db.session.add(
                    PrivateNoteMember(
                        note_id=note.id, user_id=current_user_id, role="owner"
                    )
                )

    db.session.commit()
    db.session.refresh(note)

    if current_user_id is not None:
        _set_is_owner(note, current_user_id)

    return note


def delete_note_service(note, current_user_id=None):
    """ノート削除。プライベートノートは owner のみ削除可。"""

    if note.is_private and current_user_id is not None:
        member = next(
            (m for m in note.private_members if m.user_id == current_user_id),
            None,
        )
        if member is None or member.role != "owner":
            abort(403, description="ノートの削除はオーナーのみ行えます")

    db.session.delete(note)
    db.session.commit()


def get_private_note_members_service(note, current_user_id: int):
    """プライベートノートの共有メンバー一覧を返す。オーナーのみ閲覧可。"""

    if not note.is_private:
        abort(400, description="このノートはプライベートノートではありません")

    member = next(
        (m for m in note.private_members if m.user_id == current_user_id),
        None,
    )
    if member is None or member.role != "owner":
        abort(403, description="メンバー一覧はオーナーのみ確認できます")

    return note.private_members


def add_private_note_member_service(
    note, invitee_user_id: int, role: str, current_user_id: int
):
    """プライベートノートにメンバーを追加する。オーナーのみ実行可。"""

    if not note.is_private:
        abort(400, description="このノートはプライベートノートではありません")

    # オーナー確認
    owner = next(
        (
            m
            for m in note.private_members
            if m.user_id == current_user_id and m.role == "owner"
        ),
        None,
    )
    if owner is None:
        abort(403, description="メンバーの招待はオーナーのみ行えます")

    # 重複確認
    existing = next(
        (m for m in note.private_members if m.user_id == invitee_user_id),
        None,
    )
    if existing:
        abort(409, description="すでに共有済みのユーザーです")

    new_member = PrivateNoteMember(note_id=note.id, user_id=invitee_user_id, role=role)
    db.session.add(new_member)
    db.session.commit()
    db.session.refresh(new_member)

    return new_member


def update_private_note_member_service(note, target_user_id: int, new_role: str, current_user_id: int):
    """プライベートノートのメンバーロールを変更する。オーナーのみ実行可。"""

    if not note.is_private:
        abort(400, description="このノートはプライベートノートではありません")

    # オーナー確認
    owner = next(
        (m for m in note.private_members if m.user_id == current_user_id and m.role == "owner"),
        None,
    )
    if owner is None:
        abort(403, description="ロールの変更はオーナーのみ行えます")

    # owner 自身のロール変更は不可
    if target_user_id == current_user_id:
        abort(400, description="オーナー自身のロールは変更できません")

    target = next(
        (m for m in note.private_members if m.user_id == target_user_id),
        None,
    )
    if target is None:
        abort(404, description="指定したユーザーは共有メンバーではありません")

    target.role = new_role
    db.session.commit()
    db.session.refresh(target)

    return target


def remove_private_note_member_service(note, target_user_id: int, current_user_id: int):
    """プライベートノートのメンバーを削除する。オーナーのみ実行可。"""

    if not note.is_private:
        abort(400, description="このノートはプライベートノートではありません")

    # オーナー確認
    owner = next(
        (
            m
            for m in note.private_members
            if m.user_id == current_user_id and m.role == "owner"
        ),
        None,
    )
    if owner is None:
        abort(403, description="メンバーの削除はオーナーのみ行えます")

    # owner 自身は削除不可（削除するとオーナーなしになる）
    if target_user_id == current_user_id:
        abort(400, description="オーナー自身を削除することはできません")

    target = next(
        (m for m in note.private_members if m.user_id == target_user_id),
        None,
    )
    if target is None:
        abort(404, description="指定したユーザーは共有メンバーではありません")

    db.session.delete(target)
    db.session.commit()
