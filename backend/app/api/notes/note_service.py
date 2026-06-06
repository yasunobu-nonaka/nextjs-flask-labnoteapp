from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.model import Note, Tag
from app.api.notes.tag_service import get_or_create_tags


def get_notes_service(user_id, query_word=None, tag_name=None, page=1, per_page=10):
    """
    ノート一覧取得
    """

    query = db.select(Note).filter_by(user_id=user_id).options(selectinload(Note.tags))
    count_query = db.select(func.count(Note.id)).filter_by(user_id=user_id)

    if query_word:
        query = query.filter(Note.title.ilike(f"%{query_word}%"))
        count_query = count_query.filter(Note.title.ilike(f"%{query_word}%"))

    if tag_name:
        query = query.filter(Note.tags.any(Tag.tagname == tag_name))
        count_query = count_query.filter(Note.tags.any(Tag.tagname == tag_name))

    total = db.session.execute(count_query).scalar_one()
    offset = (page - 1) * per_page
    notes = db.session.execute(
        query.order_by(Note.id).offset(offset).limit(per_page)
    ).scalars().all()

    return notes, total


def get_note_or_404_service(note_id, user_id):
    """
    単一ノート取得
    """

    note = db.one_or_404(
        db.select(Note)
        .filter_by(id=note_id, user_id=user_id)
        .options(selectinload(Note.tags))
    )

    return note


def create_note_service(data, user_id):
    """
    ノート作成
    """

    note = Note(
        user_id=user_id,
        title=data["title"],
        content_md=data["content_md"],
    )

    tags = get_or_create_tags(data.get("tags", []), user_id)

    note.tags.extend(tags)

    db.session.add(note)
    db.session.commit()

    return note


def update_note_service(note, data, user_id):
    """
    ノート更新
    """

    if "title" in data:
        note.title = data["title"]

    if "content_md" in data:
        note.content_md = data["content_md"]

    if "tags" in data:
        tags = get_or_create_tags(data["tags"], user_id)

        note.tags = tags

    db.session.commit()

    return note


def delete_note_service(note):
    """
    ノート削除
    """

    db.session.delete(note)
    db.session.commit()
