import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import OrgCreateModal from "./OrgCreateModal";

// デフォルトでは常に成功レスポンスを返す。個別のテストで失敗パターンを
// 検証したいときは server.use(...) でこのテストの間だけハンドラーを上書きする。
const server = setupServer(
  http.post("*/api/organizations", () => {
    return HttpResponse.json(
      { organization: { id: 1, name: "研究室A" } },
      { status: 201 },
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => server.close());

describe("OrgCreateModal", () => {
  it("組織名が空のときは「作成」ボタンが無効化されている", () => {
    render(<OrgCreateModal isOpen={true} onClose={jest.fn()} onCreated={jest.fn()} />);

    expect(screen.getByRole("button", { name: "作成" })).toBeDisabled();
  });

  it("組織名を入力して作成すると、正しい内容でPOSTし onCreated が呼ばれる", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onCreated = jest.fn();

    let receivedBody: unknown = null;
    server.use(
      http.post("*/api/organizations", async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(
          { organization: { id: 1, name: "研究室A" } },
          { status: 201 },
        );
      }),
    );

    render(<OrgCreateModal isOpen={true} onClose={onClose} onCreated={onCreated} />);

    await user.type(screen.getByPlaceholderText("組織名を入力"), "研究室A");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith({ id: 1, name: "研究室A" });
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // フォームで直接変更していないデフォルトのポリシーも含めて、
    // 正しい内容がリクエストボディに乗っているかを確認する
    expect(receivedBody).toEqual({
      name: "研究室A",
      policy: {
        allow_private_groups: true,
        allow_private_notes: true,
        who_can_create_groups: "member",
        default_join_method: "invite_only",
      },
    });
  });

  it("送信中は「作成中...」と表示され、ボタンが無効化される", async () => {
    const user = userEvent.setup();

    // レスポンスをこちらの好きなタイミングまで止めておくための deferred promise
    let resolveResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      resolveResponse = resolve;
    });
    server.use(
      http.post("*/api/organizations", async () => {
        await responseGate;
        return HttpResponse.json(
          { organization: { id: 1, name: "研究室A" } },
          { status: 201 },
        );
      }),
    );

    render(<OrgCreateModal isOpen={true} onClose={jest.fn()} onCreated={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("組織名を入力"), "研究室A");
    await user.click(screen.getByRole("button", { name: "作成" }));

    // authFetch の応答がまだ返っていない間は「作成中...」のはず
    const submittingButton = screen.getByRole("button", { name: "作成中..." });
    expect(submittingButton).toBeDisabled();

    // レスポンスを解放して後片付け（このテストの検証自体は上のexpectで完了している）
    resolveResponse();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "作成中..." })).not.toBeInTheDocument();
    });
  });

  it("サーバーがエラーを返すとメッセージを表示し、onCreated は呼ばれない", async () => {
    const user = userEvent.setup();
    const onCreated = jest.fn();

    server.use(
      http.post("*/api/organizations", () => {
        return HttpResponse.json(
          { message: "同名の組織が既に存在します" },
          { status: 400 },
        );
      }),
    );

    render(<OrgCreateModal isOpen={true} onClose={jest.fn()} onCreated={onCreated} />);

    await user.type(screen.getByPlaceholderText("組織名を入力"), "研究室A");
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(
      await screen.findByText("同名の組織が既に存在します"),
    ).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("ネットワークエラー時は接続失敗のメッセージを表示する", async () => {
    const user = userEvent.setup();

    server.use(
      http.post("*/api/organizations", () => {
        return HttpResponse.error();
      }),
    );

    render(<OrgCreateModal isOpen={true} onClose={jest.fn()} onCreated={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("組織名を入力"), "研究室A");
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(
      await screen.findByText("サーバーへの接続に失敗しました"),
    ).toBeInTheDocument();
  });

  it("ポリシーのラジオボタンを変更すると、その内容がリクエストに反映される", async () => {
    const user = userEvent.setup();

    let receivedBody: unknown = null;
    server.use(
      http.post("*/api/organizations", async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(
          { organization: { id: 1, name: "研究室A" } },
          { status: 201 },
        );
      }),
    );

    render(<OrgCreateModal isOpen={true} onClose={jest.fn()} onCreated={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("組織名を入力"), "研究室A");
    // 「プライベートグループの作成」を初期値の「許可」から「禁止」に変更する
    await user.click(screen.getAllByRole("radio", { name: "禁止" })[0]);
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      const body = receivedBody as { policy?: { allow_private_groups?: boolean } };
      expect(body.policy?.allow_private_groups).toBe(false);
    });
  });
});
