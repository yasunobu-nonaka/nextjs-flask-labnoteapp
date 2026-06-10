"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/api";

type Folder = {
  id: number;
  name: string;
  parent_id: number | null;
};

type FolderNode = Folder & { children: FolderNode[] };

function buildTree(folders: Folder[], parentId: number | null = null): FolderNode[] {
  return folders
    .filter((f) => f.parent_id === parentId)
    .map((f) => ({ ...f, children: buildTree(folders, f.id) }));
}

function FolderItem({
  node,
  depth,
  selectedId,
  onSelect,
  onMutation,
  onDeselect,
}: {
  node: FolderNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMutation: () => void;
  onDeselect: (id: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [childName, setChildName] = useState("");

  async function handleRename() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const res = await authFetch(`/api/folders/${node.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setIsEditing(false);
      onMutation();
    }
  }

  async function handleDelete() {
    const hasChildren = node.children.length > 0;
    const message = hasChildren
      ? `「${node.name}」を削除すると、子フォルダーとその中のノートもすべて削除されます。よろしいですか？`
      : `「${node.name}」を削除しますか？中のノートも削除されます。`;
    if (!confirm(message)) return;
    const res = await authFetch(`/api/folders/${node.id}`, { method: "DELETE" });
    if (res.ok) {
      onDeselect(node.id);
      onMutation();
    }
  }

  async function handleCreateChild() {
    const trimmed = childName.trim();
    if (!trimmed) return;
    const res = await authFetch("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: trimmed, parent_id: node.id }),
    });
    if (res.ok) {
      setIsCreatingChild(false);
      setChildName("");
      onMutation();
    }
  }

  return (
    <li>
      {isEditing ? (
        <form
          onSubmit={(e) => { e.preventDefault(); handleRename(); }}
          className="flex items-center gap-1 py-0.5 pr-1"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none"
          />
          <button type="submit" className="text-xs text-blue-500 hover:underline shrink-0">
            保存
          </button>
          <button
            type="button"
            onClick={() => { setIsEditing(false); setEditName(node.name); }}
            className="text-xs text-gray-400 hover:underline shrink-0"
          >
            ✕
          </button>
        </form>
      ) : (
        <div className="group flex items-center pr-1">
          <button
            onClick={() => onSelect(selectedId === node.id ? null : node.id)}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className={`flex-1 text-left py-1.5 text-sm rounded-sm transition-colors truncate ${
              selectedId === node.id
                ? "bg-foreground text-background font-medium"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {node.name}
          </button>
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setIsCreatingChild(true)}
              title="子フォルダーを作成"
              className="p-0.5 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              +
            </button>
            <button
              onClick={() => { setIsEditing(true); setEditName(node.name); }}
              title="名前を変更"
              className="p-0.5 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ✎
            </button>
            <button
              onClick={handleDelete}
              title="削除"
              className="p-0.5 text-xs text-gray-400 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {isCreatingChild && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreateChild(); }}
          className="flex items-center gap-1 py-0.5 pr-1"
          style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
        >
          <input
            autoFocus
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="フォルダー名"
            className="flex-1 px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none"
          />
          <button type="submit" className="text-xs text-blue-500 hover:underline shrink-0">
            作成
          </button>
          <button
            type="button"
            onClick={() => { setIsCreatingChild(false); setChildName(""); }}
            className="text-xs text-gray-400 hover:underline shrink-0"
          >
            ✕
          </button>
        </form>
      )}

      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <FolderItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onMutation={onMutation}
              onDeselect={onDeselect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FolderSidebar({
  selectedFolderId,
  onSelectFolder,
}: {
  selectedFolderId: number | null;
  onSelectFolder: (id: number | null) => void;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [rootName, setRootName] = useState("");

  const fetchFolders = useCallback(async () => {
    const res = await authFetch("/api/folders");
    if (res.ok) {
      const data: Folder[] = await res.json();
      setFolders(data);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  async function handleCreateRoot() {
    const trimmed = rootName.trim();
    if (!trimmed) return;
    const res = await authFetch("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: trimmed, parent_id: null }),
    });
    if (res.ok) {
      setIsCreatingRoot(false);
      setRootName("");
      fetchFolders();
    }
  }

  function handleDeselect(deletedId: number) {
    if (selectedFolderId === deletedId) {
      onSelectFolder(null);
    }
  }

  const tree = buildTree(folders);

  return (
    <aside className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 pt-10 pb-6 px-3 flex flex-col gap-3">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          フォルダー
        </h2>
        <button
          onClick={() => setIsCreatingRoot(true)}
          title="フォルダーを作成"
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm leading-none"
        >
          +
        </button>
      </div>

      <ul className="flex flex-col gap-0.5">
        <li>
          <button
            onClick={() => onSelectFolder(null)}
            className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
              selectedFolderId === null
                ? "bg-foreground text-background font-medium"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            すべてのノート
          </button>
        </li>

        {isCreatingRoot && (
          <li>
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreateRoot(); }}
              className="flex items-center gap-1 py-0.5 px-2"
            >
              <input
                autoFocus
                value={rootName}
                onChange={(e) => setRootName(e.target.value)}
                placeholder="フォルダー名"
                className="flex-1 px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none"
              />
              <button type="submit" className="text-xs text-blue-500 hover:underline shrink-0">
                作成
              </button>
              <button
                type="button"
                onClick={() => { setIsCreatingRoot(false); setRootName(""); }}
                className="text-xs text-gray-400 hover:underline shrink-0"
              >
                ✕
              </button>
            </form>
          </li>
        )}

        {tree.map((node) => (
          <FolderItem
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedFolderId}
            onSelect={onSelectFolder}
            onMutation={fetchFolders}
            onDeselect={handleDeselect}
          />
        ))}
      </ul>
    </aside>
  );
}
