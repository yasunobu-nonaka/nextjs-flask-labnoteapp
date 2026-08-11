import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RadioGroup from "./RadioGroup";

const options = [
  { value: "member", label: "メンバー" },
  { value: "user_admin", label: "ユーザー管理者" },
];

describe("RadioGroup", () => {
  it("各選択肢がラベル付きのラジオボタンとして表示される", () => {
    // 1. render(): コンポーネントを jsdom 上にマウントする
    render(
      <RadioGroup
        name="role"
        options={options}
        value="member"
        onChange={() => {}}
      />,
    );

    // 2. screen.getByRole(): 「role=radio かつラベルが"メンバー"の要素」を探す
    //    class名やDOM構造ではなく、ユーザーから見える情報（ラベルテキスト）で探すのが RTL の基本
    expect(
      screen.getByRole("radio", { name: "メンバー" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "ユーザー管理者" }),
    ).toBeInTheDocument();
  });

  it("value プロパティに一致する選択肢だけが checked になる", () => {
    render(
      <RadioGroup
        name="role"
        options={options}
        value="user_admin"
        onChange={() => {}}
      />,
    );

    // 3. 見た目の状態（チェックされているか）を検証する
    expect(screen.getByRole("radio", { name: "メンバー" })).not.toBeChecked();
    expect(
      screen.getByRole("radio", { name: "ユーザー管理者" }),
    ).toBeChecked();
  });

  it("選択肢をクリックすると、その値で onChange が呼ばれる", async () => {
    // 4. userEvent.setup(): クリックなどの操作をシミュレートする準備
    const user = userEvent.setup();
    // 5. モック関数: 「呼ばれたかどうか・何が渡されたか」を記録する
    const handleChange = jest.fn();

    render(
      <RadioGroup
        name="role"
        options={options}
        value="member"
        onChange={handleChange}
      />,
    );

    // 6. 実際にユーザーがクリックする操作を再現する
    await user.click(screen.getByRole("radio", { name: "ユーザー管理者" }));

    // 7. RadioGroup 自身は value を書き換えない（親から渡された state を書き換えるのは
    //    呼び出し側の責務）ので、ここでは「正しい値で onChange が呼ばれたか」だけを検証する
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("user_admin");
  });

  it("description を持つ選択肢では説明文も表示される", () => {
    render(
      <RadioGroup
        name="role"
        options={[
          { value: "open", label: "自由参加", description: "誰でも参加できます" },
        ]}
        value="open"
        onChange={() => {}}
      />,
    );

    expect(screen.getByText("誰でも参加できます")).toBeInTheDocument();
  });
});
