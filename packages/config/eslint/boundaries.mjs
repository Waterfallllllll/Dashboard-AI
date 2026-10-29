const sourceFiles = ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"];
const webFiles = ["apps/web/**/*.{js,mjs,jsx,ts,tsx}"];
const apiFiles = [
  "apps/api/**/*.{js,mjs,cjs,ts,mts,cts}",
  "scripts/**/*.{js,mjs,cjs,ts,mts,cts}"
];
const contractFiles = ["packages/contracts/**/*.{js,mjs,cjs,ts,mts,cts}"];

const forbiddenStackMessage = {
  tailwind: "Tailwind CSS не входит в стек. Стили — SCSS Modules и CSS custom properties.",
  cssInJs: "runtime CSS-in-JS не используется. Стили — SCSS Modules.",
  prisma: "Prisma/Drizzle не входят в стек. Хранилище — MongoDB Driver.",
  graphql: "GraphQL не входит в стек. API — REST /api/v1.",
  postgres: "PostgreSQL не входит в стек. Хранилище — MongoDB."
};

const forbiddenStackPaths = [
  { name: "tailwindcss", message: forbiddenStackMessage.tailwind },
  { name: "styled-components", message: forbiddenStackMessage.cssInJs },
  { name: "styled-jsx", message: forbiddenStackMessage.cssInJs },
  { name: "@emotion/react", message: forbiddenStackMessage.cssInJs },
  { name: "@emotion/styled", message: forbiddenStackMessage.cssInJs },
  { name: "@emotion/css", message: forbiddenStackMessage.cssInJs },
  { name: "prisma", message: forbiddenStackMessage.prisma },
  { name: "@prisma/client", message: forbiddenStackMessage.prisma },
  { name: "drizzle-orm", message: forbiddenStackMessage.prisma },
  { name: "graphql", message: forbiddenStackMessage.graphql },
  { name: "graphql-tag", message: forbiddenStackMessage.graphql },
  { name: "@apollo/client", message: forbiddenStackMessage.graphql },
  { name: "pg", message: forbiddenStackMessage.postgres },
  { name: "postgres", message: forbiddenStackMessage.postgres }
];

const forbiddenStackPatterns = [
  { group: ["tailwindcss/*", "@tailwindcss/*"], message: forbiddenStackMessage.tailwind },
  { group: ["styled-jsx/*"], message: forbiddenStackMessage.cssInJs },
  { group: ["@emotion/*"], message: forbiddenStackMessage.cssInJs },
  { group: ["@prisma/*"], message: forbiddenStackMessage.prisma },
  { group: ["drizzle-orm/*"], message: forbiddenStackMessage.prisma },
  { group: ["@apollo/*"], message: forbiddenStackMessage.graphql }
];

const backendOnlyMessage =
  "Frontend не импортирует backend-пакеты и не подключается к MongoDB. Данные — через /api/v1.";
const frontendOnlyMessage =
  "apps/api не импортирует frontend-код. UI живёт в apps/web.";
const contractsMessage =
  "packages/contracts содержит только сериализуемые DTO и Zod-схемы: без UI, Express и MongoDB.";

const backendOnlyPaths = [
  { name: "mongodb", message: backendOnlyMessage },
  { name: "bson", message: backendOnlyMessage },
  { name: "express", message: backendOnlyMessage },
  { name: "helmet", message: backendOnlyMessage },
  { name: "cors", message: backendOnlyMessage },
  { name: "compression", message: backendOnlyMessage },
  { name: "cookie-parser", message: backendOnlyMessage },
  { name: "express-rate-limit", message: backendOnlyMessage },
  { name: "pino", message: backendOnlyMessage },
  { name: "pino-http", message: backendOnlyMessage },
  { name: "googleapis", message: backendOnlyMessage },
  { name: "openid-client", message: backendOnlyMessage },
  { name: "rss-parser", message: backendOnlyMessage },
  { name: "web-push", message: backendOnlyMessage }
];

const frontendOnlyPaths = [
  { name: "react", message: frontendOnlyMessage },
  { name: "react-dom", message: frontendOnlyMessage },
  { name: "next", message: frontendOnlyMessage },
  { name: "lucide-react", message: frontendOnlyMessage },
  { name: "@dnd-kit/core", message: frontendOnlyMessage },
  { name: "@dnd-kit/sortable", message: frontendOnlyMessage },
  { name: "@dnd-kit/utilities", message: frontendOnlyMessage },
  { name: "react-hook-form", message: frontendOnlyMessage },
  { name: "@hookform/resolvers", message: frontendOnlyMessage }
];

const frontendOnlyPatterns = [
  { group: ["react/*", "react-dom/*"], message: frontendOnlyMessage },
  { group: ["next/*"], message: frontendOnlyMessage },
  { group: ["@dnd-kit/*"], message: frontendOnlyMessage }
];

const webToApiPatterns = [
  {
    group: ["@dashboard/api", "@dashboard/api/*", "**/apps/api/**", "**/api/src/**"],
    message: "apps/web не импортирует код из apps/api. Общий контракт — @dashboard/contracts."
  }
];

const apiToWebPatterns = [
  {
    group: ["@dashboard/web", "@dashboard/web/*", "**/apps/web/**"],
    message: "apps/api не импортирует frontend-код. Общий контракт — @dashboard/contracts."
  }
];

const featureInternalsPattern = {
  group: ["@/features/*/*", "@/features/*/**", "**/src/features/*/*", "**/src/features/*/**"],
  message:
    "Feature экспортирует публичный API только через index.ts. Импортируй `@/features/<name>`."
};

const layerFile = (layer) => [`**/*.${layer}`, `**/*.${layer}.*`];

function restrictedImports({ paths = [], patterns = [] } = {}) {
  return [
    "error",
    {
      paths: [...forbiddenStackPaths, ...paths],
      patterns: [...forbiddenStackPatterns, ...patterns]
    }
  ];
}

export default [
  {
    name: "dashboard/boundaries/stack",
    files: sourceFiles,
    rules: {
      "no-restricted-imports": restrictedImports()
    }
  },
  {
    name: "dashboard/boundaries/web",
    files: webFiles,
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: backendOnlyPaths,
        patterns: [...webToApiPatterns, featureInternalsPattern]
      })
    }
  },
  {
    name: "dashboard/boundaries/api",
    files: apiFiles,
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: frontendOnlyPaths,
        patterns: [...frontendOnlyPatterns, ...apiToWebPatterns]
      })
    }
  },
  {
    name: "dashboard/boundaries/contracts",
    files: contractFiles,
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: [
          ...backendOnlyPaths.map((item) => ({ ...item, message: contractsMessage })),
          ...frontendOnlyPaths.map((item) => ({ ...item, message: contractsMessage }))
        ],
        patterns: frontendOnlyPatterns.map((item) => ({ ...item, message: contractsMessage }))
      })
    }
  },
  {
    name: "dashboard/boundaries/no-route-handlers",
    files: ["apps/web/src/app/**/route.ts", "apps/web/src/app/**/route.js", "apps/web/src/app/**/route.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program",
          message:
            "Next.js Route Handlers не используются как доменный backend. REST, OAuth и webhook живут в apps/api."
        }
      ]
    }
  },
  {
    name: "dashboard/boundaries/auth-storage",
    files: ["apps/web/src/features/auth/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message:
            "OAuth-токены и серверная сессия не хранятся в localStorage. Сессия — HttpOnly cookie."
        },
        {
          name: "sessionStorage",
          message: "OAuth-токены и серверная сессия не хранятся в browser storage."
        }
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='localStorage']",
          message:
            "OAuth-токены и серверная сессия не хранятся в localStorage. Сессия — HttpOnly cookie."
        },
        {
          selector: "MemberExpression[property.name='sessionStorage']",
          message: "OAuth-токены и серверная сессия не хранятся в browser storage."
        }
      ]
    }
  },
  {
    name: "dashboard/boundaries/api-repository",
    files: ["apps/api/**/*.repository.ts", "apps/api/**/*.repository.js"],
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: frontendOnlyPaths,
        patterns: [
          ...frontendOnlyPatterns,
          ...apiToWebPatterns,
          {
            group: [
              ...layerFile("service"),
              ...layerFile("controller"),
              ...layerFile("routes")
            ],
            message:
              "Обратные импорты запрещены: repository не импортирует service, controller или routes."
          }
        ]
      })
    }
  },
  {
    name: "dashboard/boundaries/api-service",
    files: ["apps/api/**/*.service.ts", "apps/api/**/*.service.js"],
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: frontendOnlyPaths,
        patterns: [
          ...frontendOnlyPatterns,
          ...apiToWebPatterns,
          {
            group: [...layerFile("controller"), ...layerFile("routes")],
            message: "Обратные импорты запрещены: service не импортирует controller или routes."
          },
          {
            group: ["../*/*.repository", "../*/*.repository.*", "**/modules/*/*.repository", "**/modules/*/*.repository.*"],
            message:
              "Модуль не обращается к repository другого модуля — только через публичный service."
          }
        ]
      })
    }
  },
  {
    name: "dashboard/boundaries/api-controller",
    files: ["apps/api/**/*.controller.ts", "apps/api/**/*.controller.js"],
    rules: {
      "no-restricted-imports": restrictedImports({
        paths: frontendOnlyPaths,
        patterns: [
          ...frontendOnlyPatterns,
          ...apiToWebPatterns,
          {
            group: [...layerFile("routes"), ...layerFile("repository")],
            message:
              "Controller вызывает service и не импортирует routes или repository другого слоя."
          }
        ]
      })
    }
  }
];
