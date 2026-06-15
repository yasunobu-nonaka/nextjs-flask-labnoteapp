from app.extensions import db
from app.model import Tag


def check_and_create_tag(tag_name, group_id):
    """タグ取得 or 作成。グループスコープで検索する。"""

    tag = db.session.execute(
        db.select(Tag).filter_by(tagname=tag_name, group_id=group_id)
    ).scalar_one_or_none()

    if tag:
        return tag

    tag = Tag(tagname=tag_name, group_id=group_id)
    db.session.add(tag)

    return tag


def get_group_tags(group_id):
    """グループが持つタグ名一覧を取得する。"""

    tags = db.session.execute(
        db.select(Tag).filter_by(group_id=group_id).order_by(Tag.tagname)
    ).scalars().all()
    return [tag.tagname for tag in tags]


def get_or_create_tags(tag_names, group_id):
    """タグ一覧取得 or 作成。グループスコープで処理する。"""

    tags = []
    for tag_name in tag_names:
        tag = check_and_create_tag(tag_name, group_id)
        if tag:
            tags.append(tag)
    return tags
