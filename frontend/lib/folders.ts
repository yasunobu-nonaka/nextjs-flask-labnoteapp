// API から返されるフォルダーの型
export type Folder = {
  id: number;
  name: string;
  parent_id: number | null; // ルートフォルダーは null
};

// <select> の各 <option> に対応する型
export type FolderOption = {
  id: number;
  label: string; // 階層の深さに応じて "—" プレフィックスを付けた表示名
};

/**
 * buildFolderOptionsメソッド
 * フラットなフォルダー配列を <select> 用のオプション一覧に変換する。
 * 子フォルダーは親の直後に並び、深さに応じて "—" が先頭に付く。
 *
 * 例:
 *   Project A          (depth 0) → label: "Project A"
 *   ├─ Experiment 1    (depth 1) → label: "— Experiment 1"
 *   │   └─ Trial 1     (depth 2) → label: "—— Trial 1"
 *   └─ Experiment 2    (depth 1) → label: "— Experiment 2"
 *
 * 入力例:
 *   [
 *     { id: 1, name: "Project A",    parent_id: null },
 *     { id: 2, name: "Experiment 1", parent_id: 1    },
 *     { id: 3, name: "Trial 1",      parent_id: 2    },
 *     { id: 4, name: "Experiment 2", parent_id: 1    },
 *     { id: 5, name: "Project B",    parent_id: null },
 *   ]
 *
 * 出力例:
 *   [
 *     { id: 1, label: "Project A"       },
 *     { id: 2, label: "— Experiment 1"  },
 *     { id: 3, label: "—— Trial 1"      },
 *     { id: 4, label: "— Experiment 2"  },
 *     { id: 5, label: "Project B"       },
 *   ]
 */
export function buildFolderOptions(folders: Folder[]): FolderOption[] {
  // recurse: 指定した parentId を持つフォルダーを取り出し、
  // 各フォルダーのオプションとその子孫を深さ優先で再帰的に展開する。
  // depth は "—" の繰り返し数（= 階層の深さ）として使う。
  function recurse(parentId: number | null, depth: number): FolderOption[] {
    const children = folders.filter((f) => f.parent_id === parentId);
    const result: FolderOption[] = [];

    for (const folder of children) {
      // depth に応じた "—" プレフィックスを生成（depth 0 のときはプレフィックスなし）
      let prefix = "";
      if (depth > 0) {
        prefix = "—".repeat(depth) + " ";
      }
      result.push({ id: folder.id, label: prefix + folder.name });

      // 子フォルダーを再帰的に取得して、このフォルダーの直後に追加する
      result.push(...recurse(folder.id, depth + 1));
    }

    return result;
  }
  return recurse(null, 0);
}
