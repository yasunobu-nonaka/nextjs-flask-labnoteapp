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
// 読み込んだ上でこの config を返す非同期関数を作る。
//
// next/jest 自身も transformIgnorePatterns にデフォルト値を持っており、単純に
// config.transformIgnorePatterns を追加指定しても配列同士がマージされるだけで、
// 個々のパターンは「マッチしたら無視（=transformしない）」という OR 条件で効くため、
// 既存のより厳しいパターンが node_modules 内の ESM-only パッケージ（msw が依存する
// rettime など、require() できずビルド済み .mjs しか持たないもの）を無視し続けてしまう。
// そのため、next/jest が組み立てた config を一度実行してから、
// transformIgnorePatterns だけ「必要な例外を1つの正規表現にまとめたもの」で丸ごと上書きする。
async function resolveJestConfig() {
  const nextJestConfig = await createJestConfig(config)();
  return {
    ...nextJestConfig,
    transformIgnorePatterns: [
      "/node_modules/(?!(geist|next/dist/client|next/dist/shared/lib|next/src/client|next/src/shared/lib|msw|@mswjs|@open-draft|@bundled-es-modules|until-async|headers-polyfill|outvariant|strict-event-emitter|is-node-process|rettime)/)",
      "^.+\\.module\\.(css|sass|scss)$",
    ],
  };
}

export default resolveJestConfig;
