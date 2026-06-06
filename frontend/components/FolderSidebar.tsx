"use client";

import { useEffect, useState } from "react";
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
}: {
  node: FolderNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  return (
    <li>
      <button
        onClick={() => onSelect(selectedId === node.id ? null : node.id)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`w-full text-left py-1.5 pr-3 text-sm rounded transition-colors ${
          selectedId === node.id
            ? "bg-foreground text-background font-medium"
            : "hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
      >
        {node.name}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <FolderItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
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

  useEffect(() => {
    async function fetchFolders() {
      const res = await authFetch("/api/folders");
      if (res.ok) {
        const data: Folder[] = await res.json();
        setFolders(data);
      }
    }
    fetchFolders();
  }, []);

  const tree = buildTree(folders);

  return (
    <aside className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 pt-10 pb-6 px-3 flex flex-col gap-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
        フォルダー
      </h2>
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
        {tree.map((node) => (
          <FolderItem
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedFolderId}
            onSelect={onSelectFolder}
          />
        ))}
      </ul>
    </aside>
  );
}
