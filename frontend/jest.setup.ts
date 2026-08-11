// 全テストファイルの実行前に読み込まれる（jest.config.mjs の setupFilesAfterEnv）。
// jest-dom の matcher（toBeInTheDocument 等）を expect に追加し、TS の型定義も
// このファイルが tsconfig の include 対象であることを通じてプロジェクト全体に反映される。
import "@testing-library/jest-dom";

// jest-environment-jsdom は Fetch API（fetch / Request / Response / Headers）を実装していない。
// MSW v2 はこれらを内部で直接使うため、Node の fetch 実装（undici）から借りてきて
// jsdom のグローバルスコープに補完する（MSW 公式が案内している標準的な回避策）。
//
// undici 自体が読み込まれた瞬間に globalThis.TextDecoder を参照するため、
// 先に TextEncoder/TextDecoder を用意してから undici を読み込む必要がある。
// import 文はトランスパイル後もファイル内の位置に関わらず先頭にホイスティングされてしまい
// この順序を保証できないため、ここだけ意図的に require() を使っている。
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TextDecoder, TextEncoder } = require("node:util");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ReadableStream, TransformStream, WritableStream } = require("node:stream/web");
Object.defineProperties(globalThis, {
  TextEncoder: { value: TextEncoder, configurable: true },
  TextDecoder: { value: TextDecoder, configurable: true },
  ReadableStream: { value: ReadableStream, configurable: true },
  TransformStream: { value: TransformStream, configurable: true },
  WritableStream: { value: WritableStream, configurable: true },
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetch, Headers, Request, Response } = require("undici");
Object.defineProperties(globalThis, {
  fetch: { value: fetch, writable: true, configurable: true },
  Headers: { value: Headers, writable: true, configurable: true },
  Request: { value: Request, writable: true, configurable: true },
  Response: { value: Response, writable: true, configurable: true },
});

// MSW は WebSocket モックのために BroadcastChannel も参照する（今回は未使用の機能だが、
// import 時点で読み込まれるモジュールが参照するため用意しておく必要がある）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BroadcastChannel } = require("node:worker_threads");
Object.defineProperty(globalThis, "BroadcastChannel", {
  value: BroadcastChannel,
  configurable: true,
});
