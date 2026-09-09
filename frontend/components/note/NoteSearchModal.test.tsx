import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoteSearchModal from "./NoteSearchModal";

const availableAuthors = [
  { id: 1, username: "alice" },
  { id: 2, username: "bob" },
];

// 各テストで毎回渡す必要のある必須propsをまとめたベース。
// テストごとに一部だけ上書きして render する。
function renderModal(overrides: Partial<React.ComponentProps<typeof NoteSearchModal>> = {}) {
  const props = {
    isOpen: true,
    onClose: jest.fn(),
    query: "",
    onQueryChange: jest.fn(),
    onSearch: jest.fn(),
    selectedTags: [],
    availableTags: ["React", "TypeScript"],
    onTagToggle: jest.fn(),
    selectedAuthorIds: [],
    availableAuthors,
    onAuthorAdd: jest.fn(),
    onAuthorRemove: jest.fn(),
    ...overrides,
  };
  render(<NoteSearchModal {...props} />);
  return props;
}

describe("NoteSearchModal", () => {
  it("isOpen が false のときは何も描画しない", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText("ノート検索 & 絞り込み")).not.toBeInTheDocument();
  });

  it("キーワード入力欄に入力すると onQueryChange が呼ばれる", async () => {
    const user = userEvent.setup();
    const { onQueryChange } = renderModal();

    await user.type(screen.getByPlaceholderText("タイトルで検索..."), "実験");

    // type() は1文字ずつ onChange を発火させるので、最後に渡された文字だけを確認する
    expect(onQueryChange).toHaveBeenLastCalledWith("験");
  });

  it("「検索」ボタンを押すと onSearch と onClose の両方が呼ばれる", async () => {
    const user = userEvent.setup();
    const { onSearch, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "検索" }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("「キャンセル」ボタンを押すと onClose だけが呼ばれる", async () => {
    const user = userEvent.setup();
    const { onSearch, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("タグをクリックすると onTagToggle がそのタグ名で呼ばれる", async () => {
    const user = userEvent.setup();
    const { onTagToggle } = renderModal();

    await user.click(screen.getByRole("checkbox", { name: "React" }));

    expect(onTagToggle).toHaveBeenCalledWith("React");
  });

  it("selectedTags に含まれるタグはチェック済みで表示される", () => {
    renderModal({ selectedTags: ["React"] });

    expect(screen.getByRole("checkbox", { name: "React" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "TypeScript" }),
    ).not.toBeChecked();
  });

  it("著者をドロップダウンで選択すると onAuthorAdd が呼ばれる", async () => {
    const user = userEvent.setup();
    const { onAuthorAdd } = renderModal();

    await user.selectOptions(
      screen.getByRole("combobox"),
      screen.getByRole("option", { name: "alice" }),
    );

    expect(onAuthorAdd).toHaveBeenCalledWith(1);
  });

  it("選択済み著者のチップをクリックすると onAuthorRemove が呼ばれる", async () => {
    const user = userEvent.setup();
    const { onAuthorRemove } = renderModal({ selectedAuthorIds: [1] });

    await user.click(screen.getByRole("button", { name: "alice ×" }));

    expect(onAuthorRemove).toHaveBeenCalledWith(1);
  });

  it("availableTags が空のときはタグフィルター欄自体を表示しない", () => {
    renderModal({ availableTags: [] });
    expect(screen.queryByText("タグで絞り込み")).not.toBeInTheDocument();
  });

  it("availableAuthors が空のときは著者フィルター欄自体を表示しない", () => {
    renderModal({ availableAuthors: [] });
    expect(screen.queryByText("著者で絞り込み")).not.toBeInTheDocument();
  });
});
