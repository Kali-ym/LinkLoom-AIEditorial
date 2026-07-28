// 根级 ESLint flat config。
//
// 覆盖范围（明确不覆盖 admin/、web/，它们各自有 eslint.config）：
//   backend/src/**         TypeScript 源代码（启用类型感知规则）
//   backend/scripts/**     烟雾测试 / 维护脚本（.mjs，JS-only 规则）
//   backend/tests/**       Vitest 单元测试（TypeScript）
//   scripts/**             根维护脚本（.js / .mjs）
//   e2e/**                 Playwright e2e
//   vitest.config.ts       根配置
//   playwright.config.ts   根配置
//
// 关键规则：no-floating-promises / no-misused-promises / await-thenable
// 直接命中 backend 里若干 fire-and-forget 的 .catch() 隐患。
// no-restricted-imports 配合 Phase B1，逐步把 ServiceContext.getInstance / LocalStore facade 注入锁死。

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import eslintConfigPrettier from 'eslint-config-prettier';

const RESTRICTED_SERVICE_CONTEXT = {
  name: '../../services/ServiceContext.js',
  message:
    '请通过 ToolExecutionContext.services 获取依赖，而不是直接 import ServiceContext（参见 Phase B1）。'
};

const RESTRICTED_LOCAL_STORE = {
  name: '../../services/LocalStore.js',
  message:
    '请使用 domain/ports 中的小 Port 而非整个 LocalStore facade（参见 Phase B1）。仅 wiring 文件 (index.ts / server.ts / ServiceContext.ts) 允许 import。'
};

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      'backend/dist/**',
      'admin/**',
      'web/**',
      'data/**',
      'backups/**',
      'coverage/**',
      '.playwright/**',
      // admin/web 各自维护 lint，根级不重复扫描
      '**/.next/**'
    ]
  },

  // backend/src/** —— 启用 typescript-eslint recommended + 严格 Promise 规则（需要类型信息）
  {
    files: ['backend/src/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      eslintConfigPrettier
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      import: importPlugin
    },
    rules: {
      // Promise 必须显式 await / catch / void；历史 fire-and-forget 已在 Phase 5 收口。
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false, attributes: false } }
      ],
      // ts-ignore → ts-expect-error 迁移是渐进的，先 warn
      '@typescript-eslint/ban-ts-comment': 'warn',

      // 项目自身风格保留宽松：已有历史 any，先以 warn 形式建立基线并逐步收口
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/require-await': 'off',
      // 历史空对象类型较多，先 warn
      '@typescript-eslint/no-empty-object-type': 'warn',

      'no-empty': ['warn', { allowEmptyCatch: true }],

      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true }
        }
      ],

      'no-restricted-imports': [
        'warn',
        {
          paths: [RESTRICTED_SERVICE_CONTEXT]
        }
      ]
    }
  },

  // Plugin/Tool 实现层：禁止直接 import ServiceContext（Phase B1 已完成 → 升级为 error）
  // 允许 type-only import（BatchAgentRunnerTool 等仅用作 TS 类型签名）。
  {
    files: ['backend/src/plugins/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ServiceContext', '**/ServiceContext.js'],
              message:
                'Plugin / Tool 一律通过 ToolExecutionContext.services 拿依赖；不允许直接 import ServiceContext。',
              allowTypeImports: true
            }
          ]
        }
      ]
    }
  },

  // 服务/路由层：禁止 LocalStore facade（Phase B1 完成后升级为 error）
  {
    files: ['backend/src/services/api/**/*.ts', 'backend/src/services/agents/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['**/LocalStore', '**/LocalStore.js'],
              message:
                '请通过 domain/ports/* 小 Port 注入；LocalStore facade 仅允许在 wiring 文件 (index.ts / server.ts / ServiceContext.ts) import。'
            }
          ]
        }
      ]
    }
  },

  // 维护脚本（.mjs / .js）：纯 Node、无 TS 类型，启用基本规则
  {
    files: [
      'scripts/**/*.{js,mjs}',
      'backend/scripts/**/*.{js,mjs}',
      'web/scripts/**/*.{js,mjs}',
      'admin/scripts/**/*.{js,mjs}'
    ],
    extends: [js.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },

  // backend/tests / e2e / 根配置文件 —— 走非类型感知 recommended，避免被纳入 backend/src tsconfig
  {
    files: ['backend/tests/**/*.ts', 'e2e/**/*.ts', 'vitest.config.ts', 'playwright.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      parserOptions: {
        projectService: false
      },
      globals: {
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  }
);
