module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2020: true,
  },
  ignorePatterns: ['dist/**', 'out/**', 'node_modules/**', '**/*.js'],
  overrides: [
    {
      files: ['src/app/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              '**/infra/**',
              '**/extension/**',
              '**/legacy/**',
            ],
            paths: [
              {
                name: 'vscode',
                message: 'app 层禁止依赖 vscode',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/core/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              '**/app/**',
              '**/infra/**',
              '**/extension/**',
              '**/legacy/**',
              '**/services/**',
            ],
            paths: [
              {
                name: 'vscode',
                message: 'core 层禁止依赖 vscode',
              },
              {
                name: 'fs',
                message: 'core 层禁止依赖 Node fs',
              },
              {
                name: 'http',
                message: 'core 层禁止依赖 Node 网络模块',
              },
              {
                name: 'https',
                message: 'core 层禁止依赖 Node 网络模块',
              },
              {
                name: 'child_process',
                message: 'core 层禁止依赖 Node 子进程模块',
              },
              {
                name: 'net',
                message: 'core 层禁止依赖 Node 网络模块',
              },
              {
                name: 'tls',
                message: 'core 层禁止依赖 Node 网络模块',
              },
              {
                name: 'dgram',
                message: 'core 层禁止依赖 Node 网络模块',
              },
              {
                name: 'axios',
                message: 'core 层禁止依赖网络请求库',
              },
              {
                name: 'node-fetch',
                message: 'core 层禁止依赖网络请求库',
              },
              {
                name: 'undici',
                message: 'core 层禁止依赖网络请求库',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/infra/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              '**/extension/**',
              '**/legacy/**',
              '**/services/**',
              '**/app/usecases/**',
              '**/app/services/**',
              '**/app/errors/**',
            ],
            paths: [
              {
                name: 'vscode',
                message: 'infra 层禁止依赖 vscode',
              },
            ],
          },
        ],
      },
    },
  ],
};
