# app/api/notes/tag_service.py

from app.extensions import db
from app.model import Tag


def check_and_create_tag(tag_name, user_id):
    """
    タグ取得 or 作成
    """
    # タグの存在を確認
    tag = db.session.execute(
        db.select(Tag).filter_by(tagname=tag_name, user_id=user_id)
    ).scalar_one_or_none()

    if tag:
        return tag

    tag = Tag(tagname=tag_name, user_id=user_id)

    db.session.add(tag)

    return tag


def get_user_tags(user_id):
    """
    ユーザーが持つタグ名一覧を取得
    """
    tags = db.session.execute(
        db.select(Tag).filter_by(user_id=user_id).order_by(Tag.tagname)
    ).scalars().all()
    return [tag.tagname for tag in tags]


def get_or_create_tags(tag_names, user_id):
    """
    タグ一覧取得 or 作成
    """

    tags = []

    for tag_name in tag_names:
        tag = check_and_create_tag(tag_name, user_id)

        if tag:
            tags.append(tag)

    return tags
