"use client";

import Modal from "@/components/common/Modal";
import CreateGroupWizard from "@/components/group/CreateGroupWizard";

/**
 * GroupCreateModal コンポーネント
 * グループ作成ウィザードをモーダルでラップした薄いコンポーネント。
 * 状態管理はすべて CreateGroupWizard に委任する。
 * 作成成功後は onCreated を呼び、親コンポーネントが groups リストへの追加とページ遷移を行う。
 */
export default function GroupCreateModal({
  orgId,
  isOpen,
  onClose,
  onCreated,
}: {
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (group: { id: number; name: string }) => void;
}) {
  if (!isOpen) return null;

  return (
    <Modal title="グループを作成" onClose={onClose}>
      <CreateGroupWizard orgId={orgId} onCreated={onCreated} />
    </Modal>
  );
}
