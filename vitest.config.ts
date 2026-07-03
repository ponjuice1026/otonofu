import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// 純粋ロジック（lib/ 配下の純関数）のユニットテスト専用設定。
// コンポーネント/JSX は対象外のため environment は node、
// React 系（@vitejs/plugin-react, jsdom, testing-library）は導入しない。
// `@/*` パスエイリアスは tsconfig.json から vite-tsconfig-paths 経由で解決する。
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
