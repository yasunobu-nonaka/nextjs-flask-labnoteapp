import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Next.js アプリのルート（next.config.ts / .env ファイルを読み込むために必要）
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // tsconfig.json の paths ("@/*" -> "./*") と合わせる
    "^@/(.*)$": "<rootDir>/$1",
  },
};

// next/jest が Next.js の設定（SWC transform, next.config.ts, .env）を
// 読み込んだ上でこの config を返す非同期関数を作るので、そのまま export する
export default createJestConfig(config);
