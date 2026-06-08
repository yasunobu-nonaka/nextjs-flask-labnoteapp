export type Folder = {
  id: number;
  name: string;
  parent_id: number | null;
};

export type FolderOption = {
  id: number;
  label: string;
};

export function buildFolderOptions(folders: Folder[]): FolderOption[] {
  function recurse(parentId: number | null, depth: number): FolderOption[] {
    return folders
      .filter((f) => f.parent_id === parentId)
      .flatMap((f) => [
        {
          id: f.id,
          label: "—".repeat(depth) + (depth > 0 ? " " : "") + f.name,
        },
        ...recurse(f.id, depth + 1),
      ]);
  }
  return recurse(null, 0);
}
