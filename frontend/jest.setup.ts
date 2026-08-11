// 全テストファイルの実行前に読み込まれる（jest.config.js の setupFilesAfterEnv）。
// jest-dom の matcher（toBeInTheDocument 等）を expect に追加し、TS の型定義も
// このファイルが tsconfig の include 対象であることを通じてプロジェクト全体に反映される。
import "@testing-library/jest-dom";
