import { buildFolderOptions, type Folder } from "./folders";

describe("buildFolderOptions", () => {
  it("フラットな配列を、親子関係に沿った階層付きラベルへ変換する", () => {
    // buildFolderOptions のドキュメントコメントにある入出力例をそのままテストにしたもの
    const folders: Folder[] = [
      { id: 1, name: "Project A", parent_id: null },
      { id: 2, name: "Experiment 1", parent_id: 1 },
      { id: 3, name: "Trial 1", parent_id: 2 },
      { id: 4, name: "Experiment 2", parent_id: 1 },
      { id: 5, name: "Project B", parent_id: null },
    ];

    expect(buildFolderOptions(folders)).toEqual([
      { id: 1, label: "Project A" },
      { id: 2, label: "— Experiment 1" },
      { id: 3, label: "—— Trial 1" },
      { id: 4, label: "— Experiment 2" },
      { id: 5, label: "Project B" },
    ]);
  });

  it("フォルダーが1件もない場合は空配列を返す", () => {
    expect(buildFolderOptions([])).toEqual([]);
  });

  it("ルート直下のフォルダーにはプレフィックスが付かない", () => {
    const folders: Folder[] = [{ id: 1, name: "Project A", parent_id: null }];

    expect(buildFolderOptions(folders)).toEqual([
      { id: 1, label: "Project A" },
    ]);
  });

  it("子フォルダーは親の直後（深さ優先）に並ぶ", () => {
    // Project B の子 (id: 3) が、Project A の子孫たちより前に来てしまわないかを確認する
    const folders: Folder[] = [
      { id: 1, name: "Project A", parent_id: null },
      { id: 2, name: "Project B", parent_id: null },
      { id: 3, name: "Child of B", parent_id: 2 },
    ];

    expect(buildFolderOptions(folders)).toEqual([
      { id: 1, label: "Project A" },
      { id: 2, label: "Project B" },
      { id: 3, label: "— Child of B" },
    ]);
  });
});
