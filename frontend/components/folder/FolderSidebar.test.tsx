import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import FolderSidebar from "./FolderSidebar";

// FolderSidebar は useRouter() を呼ぶが、RTL の render() は App Router の
// Context を用意してくれないため、next/navigation ごとモックする。
// 子コンポーネント（OrgCreateModal など）はどれも next/navigation を使っていないため、
// useRouter だけを差し替えれば足りる。
const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  push.mockClear();
});
afterAll(() => server.close());

const noop = () => {};

// このテストでは「未所属グループの参加フロー」だけに関心があるため、
// 検索・新規作成まわりの props は全て空/未使用の値で埋めている。
function renderSidebar() {
  render(
    <FolderSidebar
      orgId="1"
      groupId="99"
      query=""
      onQueryChange={noop}
      onSearch={noop}
      selectedTags={[]}
      availableTags={[]}
      onTagToggle={noop}
      selectedAuthorIds={[]}
      availableAuthors={[]}
      onAuthorAdd={noop}
      onAuthorRemove={noop}
      currentFolderId={null}
      notesBase="/organizations/1/groups/99/notes"
      onCreateFolder={noop}
    />,
  );
}

// 組織情報とグループ一覧の取得（マウント時に必ず走る2つの useEffect）を模擬する
function mockOrgAndGroups(groups: unknown[]) {
  server.use(
    http.get("*/api/organizations/1", () =>
      HttpResponse.json({ name: "研究室A", role: "member", policy: null }),
    ),
    http.get("*/api/organizations/1/groups", () => HttpResponse.json(groups)),
  );
}

describe("FolderSidebar: 未所属グループの参加フロー", () => {
  it("join_method が open のグループは、参加すると即座にそのグループのノート一覧へ遷移する", async () => {
    mockOrgAndGroups([
      {
        id: 10,
        name: "オープングループ",
        is_private: false,
        role: null,
        join_status: null,
        policy: { join_method: "open" },
      },
    ]);
    server.use(
      http.post("*/api/organizations/1/groups/10/join", () =>
        HttpResponse.json({ result: "joined" }),
      ),
    );

    const user = userEvent.setup();
    renderSidebar();

    const joinButton = await screen.findByRole("button", { name: "参加" });
    await user.click(joinButton);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/organizations/1/groups/10/notes");
    });
  });

  it("join_method が request のグループは、参加申請すると「参加申請済み」表示に変わる", async () => {
    mockOrgAndGroups([
      {
        id: 11,
        name: "承認制グループ",
        is_private: false,
        role: null,
        join_status: null,
        policy: { join_method: "request" },
      },
    ]);
    server.use(
      http.post("*/api/organizations/1/groups/11/join", () =>
        HttpResponse.json({ result: "pending" }),
      ),
    );

    const user = userEvent.setup();
    renderSidebar();

    await user.click(await screen.findByRole("button", { name: "参加申請" }));

    expect(
      await screen.findByRole("button", { name: "参加申請済み ×" }),
    ).toBeInTheDocument();
  });

  it("申請済みの状態で × を押すとキャンセルされ、「参加申請」ボタンに戻る", async () => {
    mockOrgAndGroups([
      {
        id: 12,
        name: "承認制グループ",
        is_private: false,
        role: null,
        join_status: "pending",
        policy: { join_method: "request" },
      },
    ]);
    server.use(
      http.delete("*/api/organizations/1/groups/12/join", () =>
        HttpResponse.json({}),
      ),
    );

    const user = userEvent.setup();
    renderSidebar();

    await user.click(
      await screen.findByRole("button", { name: "参加申請済み ×" }),
    );

    expect(
      await screen.findByRole("button", { name: "参加申請" }),
    ).toBeInTheDocument();
  });

  it("join_method が invite_only のグループは、ボタンの代わりに「招待制」バッジを表示する", async () => {
    mockOrgAndGroups([
      {
        id: 13,
        name: "招待制グループ",
        is_private: true,
        role: null,
        join_status: null,
        policy: { join_method: "invite_only" },
      },
    ]);

    renderSidebar();

    expect(await screen.findByText("招待制")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /参加/ }),
    ).not.toBeInTheDocument();
    // 非公開グループのバッジも同じ行にあるので、ついでに確認する
    expect(screen.getByText("非公開")).toBeInTheDocument();
  });

  it("参加申請が失敗した場合はエラーメッセージを表示し、ボタンは押せる状態に戻る", async () => {
    mockOrgAndGroups([
      {
        id: 14,
        name: "承認制グループ",
        is_private: false,
        role: null,
        join_status: null,
        policy: { join_method: "request" },
      },
    ]);
    server.use(
      http.post("*/api/organizations/1/groups/14/join", () =>
        HttpResponse.json(
          { message: "このグループには参加できません" },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderSidebar();

    await user.click(await screen.findByRole("button", { name: "参加申請" }));

    expect(
      await screen.findByText("このグループには参加できません"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "参加申請" }),
    ).toBeInTheDocument();
  });
});
