import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://toshikuramochi.com',
  base: '/',
  output: 'static',  // ← 追加しておくと安心（静的ビルド明示）
});
