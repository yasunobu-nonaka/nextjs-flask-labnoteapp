from typing import List, Optional

from app.extensions import db
from app.model import Folder


def get_folders_service(user_id: int) -> List[Folder]:
    folders = db.session.execute(
        db.select(Folder).filter_by(user_id=user_id).order_by(Folder.name)
    ).scalars().all()
    return folders


def get_folder_or_404_service(folder_id: int, user_id: int) -> Folder:
    return db.one_or_404(
        db.select(Folder).filter_by(id=folder_id, user_id=user_id)
    )


def create_folder_service(name: str, parent_id: Optional[int], user_id: int) -> Folder:
    if parent_id is not None:
        parent = db.session.get(Folder, parent_id)
        if not parent or parent.user_id != user_id:
            raise ValueError("親フォルダーが見つかりません")

    folder = Folder(name=name, parent_id=parent_id, user_id=user_id)
    db.session.add(folder)
    db.session.commit()
    return folder


def rename_folder_service(folder: Folder, name: str) -> Folder:
    folder.name = name
    db.session.commit()
    return folder


def delete_folder_service(folder: Folder) -> None:
    db.session.delete(folder)
    db.session.commit()
