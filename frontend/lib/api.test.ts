import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { authFetch } from "./api";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  localStorage.clear();
});
afterAll(() => server.close());

// jsdom の window.location（と location.href のアクセサ）は non-configurable で、
// window / defineProperty / jest.spyOn のどれを試しても差し替えられない
// （実ブラウザの「location は unforgeable」という仕様に合わせた挙動）。
// そのため window.location.href = "/login" という代入自体を検証することは諦め、
// jsdom が出す "Not implemented: navigation" という無害な警告だけ黙らせておく。
// 副作用として実際に確認できる localStorage のクリア・レスポンスの中身の検証に絞る。
let consoleErrorSpy: jest.SpyInstance;
beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe("authFetch", () => {
  it("200が返るときはリフレッシュを試みず、そのレスポンスをそのまま返す", async () => {
    localStorage.setItem("access_token", "valid-access-token");
    localStorage.setItem("refresh_token", "valid-refresh-token");

    const refreshListener = jest.fn();
    server.use(
      http.post("*/api/auth/refresh", () => {
        refreshListener();
        return HttpResponse.json({ access_token: "unused" });
      }),
      http.get("*/api/organizations", ({ request }) => {
        // Authorization ヘッダーに access_token が正しく乗っているかもここで確認する
        expect(request.headers.get("Authorization")).toBe(
          "Bearer valid-access-token",
        );
        return HttpResponse.json({ data: "ok" }, { status: 200 });
      }),
    );

    const res = await authFetch("/api/organizations");

    expect(res.status).toBe(200);
    expect(refreshListener).not.toHaveBeenCalled();
  });

  it("401 & refresh_tokenがない場合は、リフレッシュを試みずログアウト処理をする", async () => {
    localStorage.setItem("access_token", "expired-access-token");
    // refresh_token はセットしない

    const refreshListener = jest.fn();
    server.use(
      http.post("*/api/auth/refresh", () => {
        refreshListener();
        return HttpResponse.json({ access_token: "unused" });
      }),
      http.get("*/api/organizations", () => {
        return HttpResponse.json({}, { status: 401 });
      }),
    );

    const res = await authFetch("/api/organizations");

    expect(res.status).toBe(401);
    expect(refreshListener).not.toHaveBeenCalled();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("401 & リフレッシュAPIが失敗する場合は、ログアウト処理をする", async () => {
    localStorage.setItem("access_token", "expired-access-token");
    localStorage.setItem("refresh_token", "expired-refresh-token");

    server.use(
      http.post("*/api/auth/refresh", () => {
        return HttpResponse.json({ message: "refresh token expired" }, { status: 401 });
      }),
      http.get("*/api/organizations", () => {
        return HttpResponse.json({}, { status: 401 });
      }),
    );

    const res = await authFetch("/api/organizations");

    expect(res.status).toBe(401);
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("401 & リフレッシュ成功時は、新トークンで元のリクエストをリトライして成功レスポンスを返す", async () => {
    localStorage.setItem("access_token", "old-access-token");
    localStorage.setItem("refresh_token", "valid-refresh-token");

    server.use(
      http.post("*/api/auth/refresh", ({ request }) => {
        expect(request.headers.get("Authorization")).toBe(
          "Bearer valid-refresh-token",
        );
        return HttpResponse.json({ access_token: "new-access-token" });
      }),
      // 1回目（トークン切れ）だけ 401 を返し、以降はフォールスルーして下のハンドラーに渡す
      http.get(
        "*/api/organizations",
        () => HttpResponse.json({}, { status: 401 }),
        { once: true },
      ),
      // 2回目（リトライ）はここに到達する
      http.get("*/api/organizations", ({ request }) => {
        expect(request.headers.get("Authorization")).toBe(
          "Bearer new-access-token",
        );
        return HttpResponse.json({ data: "ok" }, { status: 200 });
      }),
    );

    const res = await authFetch("/api/organizations");

    expect(res.status).toBe(200);
    expect(localStorage.getItem("access_token")).toBe("new-access-token");
  });
});
