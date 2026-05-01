import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react: reactPlugin },
    rules: {
      // Stricter recommended rules
      'no-unused-vars': 'error',
      'no-console': 'warn',
      eqeqeq: 'error',
      curly: 'error',
      'no-return-await': 'error',
      'no-implicit-coercion': 'error',
      'no-shadow': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'no-multi-spaces': 'error',
      'no-useless-catch': 'error',
      'no-duplicate-imports': 'error',
      // Add or override more rules as needed
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        process: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
];
