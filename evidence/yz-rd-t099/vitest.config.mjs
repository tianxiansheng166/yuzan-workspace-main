import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire('/home/tian/.devspace/worktrees/yuzan-owner-uat-20261021/backend/api/package.json');
export default {
  root: path.resolve(import.meta.dirname, '../../backend/api'),
  cacheDir: path.resolve(import.meta.dirname, '.vite'),
  plugins: [{ name: 'reuse-installed-dependencies', enforce: 'pre', resolveId(id) {
    if (id === 'vitest') return path.join(path.dirname(require.resolve('vitest/package.json')), 'dist/index.js');
    if (!id.startsWith('.') && !id.startsWith('/') && !id.startsWith('node:')) {
      try { return require.resolve(id); } catch { return null; }
    }
  }}],
  test: { environment: 'node' },
};
