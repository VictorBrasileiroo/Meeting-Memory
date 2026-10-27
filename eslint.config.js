import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-dev/**', 'dist-chunk-test/**', 'dist-diagnostic/**', 'node_modules/**', 'coverage/**', '.verification/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        chrome: 'readonly', __FOUNDATION_MOCK__: 'readonly',
        document: 'readonly', window: 'readonly', console: 'readonly',
        URL: 'readonly', crypto: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        process: 'readonly',
      },
    },
  },
);
