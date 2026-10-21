import { createRequire } from 'node:module';
const require = createRequire('/home/tian/.devspace/worktrees/yuzan-owner-uat-20261021/backend/api/package.json');
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { project: import.meta.dirname + '/lint-tsconfig.json', tsconfigRootDir: import.meta.dirname } } },
);
