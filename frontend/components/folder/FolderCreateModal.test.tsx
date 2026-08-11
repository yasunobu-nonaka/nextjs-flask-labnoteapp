import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import FolderCreateModal from "./FolderCreateModal";

// このテストファイルが投げるリクエストを模擬するモックサーバー。
// "*" は「オリジン（http://localhost:5000 など）は問わない」という意味で、
// authFetch が NEXT_PUBLIC_API_URL をどう解決していてもパスさえ合えば拾える。
const server = setupServer(
  http.post(
    "*/api/organizations/:orgId/groups/:groupId/folders",
    () => {
      return HttpResponse.json(
        { id: 1, name: "実験ノート", parent_id: null },
        { status: 201 },
      );
    },
  ),
);

// テストファイル全体で1回だけサーバーを起動し、各テストの後にハンドラーとイベントリスナーを
// リセットし、全テスト終了後に停止する（Jest の beforeAll/afterEach/afterAll フック）
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => server.close());

describe("FolderCreateModal", () => {
  it("フォルダー名を入力して作成すると、onClose と onCreated が呼ばれる", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onCreated = jest.fn();

    render(
      <FolderCreateModal
        isOpen={true}
        onClose={onClose}
        orgId={1}
        groupId={2}
        currentFolderId={null}
        onCreated={onCreated}
      />,
    );

    await user.type(
      screen.getByPlaceholderText("フォルダー名"),
      "実験ノート",
    );
    await user.click(screen.getByRole("button", { name: "作成" }));

    // authFetch は非同期なので、結果が反映されるまで待つ必要がある
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("フォルダー名が空のときは送信されない（リクエストが飛ばない）", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onCreated = jest.fn();

    // MSW のライフサイクルイベントを使って「実際にリクエストが飛んだか」を検知する。
    // ハンドラーの戻り値ではなく、リクエストが送信された事実そのものを検証したいときに使う。
    const requestListener = jest.fn();
    server.events.on("request:start", requestListener);

    render(
      <FolderCreateModal
        isOpen={true}
        onClose={onClose}
        orgId={1}
        groupId={2}
        currentFolderId={null}
        onCreated={onCreated}
      />,
    );

    // フォルダー名を入力せずにそのまま「作成」を押す
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(requestListener).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
