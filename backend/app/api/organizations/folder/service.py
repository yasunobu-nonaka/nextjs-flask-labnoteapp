from typing import List, Optional

from app.extensions import db
from app.model import Folder


def get_folders_service(group_id: int) -> List[Folder]:
    """グループ内のフォルダー一覧を取得する。"""

    return db.session.execute(
        db.select(Folder).filter_by(group_id=group_id).order_by(Folder.name)
    ).scalars().all()


def get_folder_or_404_service(folder_id: int, group_id: int) -> Folder:
    """フォルダーを取得する。グループ所有を確認し、存在しない場合は404を返す。"""

    return db.one_or_404(
        db.select(Folder).filter_by(id=folder_id, group_id=group_id)
    )


def create_folder_service(
    name: str, parent_id: Optional[int], group_id: int, user_id: int
) -> Folder:
    """フォルダーを作成する。group_id でグループ所有、user_id で作成者を記録する。"""

    if parent_id is not None:
        parent = db.session.get(Folder, parent_id)
        if not parent or parent.group_id != group_id:
            raise ValueError("親フォルダーが見つかりません")

    folder = Folder(
        name=name,
        parent_id=parent_id,
        group_id=group_id,
        created_by_user_id=user_id,
    )
    db.session.add(folder)
    db.session.commit()
    return folder


def rename_folder_service(folder: Folder, name: str) -> Folder:
    """フォルダーをリネームする。"""

    folder.name = name
    db.session.commit()
    return folder


def delete_folder_service(folder: Folder) -> None:
    """フォルダーを削除する（子フォルダーと所属ノートもカスケード削除）。"""

    db.session.delete(folder)
    db.session.commit()
