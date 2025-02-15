import stylistic from "@stylistic/eslint-plugin"
import tseslint from "typescript-eslint"
import angular from "angular-eslint"
import preferArrow from "eslint-plugin-prefer-arrow-functions"

export default tseslint.config (
  {
    ignores: [
      "node_modules/**/*",
      "dist/**/*",
      "coverage/**/*",
      "projects/**/*",
      ".angular/**/*",
      ".vscode/**/*",
    ]
  },
  {
    plugins: {
      "@stylistic": stylistic,
      "@arrowFunction": preferArrow
    },
    files: [
      "**/*.ts"
    ],
    extends: [
      ...tseslint.configs.recommended,
      ...angular.configs.tsAll,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2024,
      parserOptions: {
        projectService: true,
        createDefaultProgram: true
      },
    },
    rules: {
      "@angular-eslint/prefer-standalone": "error",
      "@angular-eslint/prefer-signals": "error",
      "@angular-eslint/prefer-on-push-component-change-detection": "error",
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: [
            "app",
            "iqx"
          ],
          style: "kebab-case"
        }
      ],
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: [
            "app",
            "iqx"
          ],
          style: "camelCase"
        }
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: [
            "classProperty",
            "typeProperty",
            "classMethod",
            "objectLiteralMethod",
            "typeMethod",
            "accessor",
            "enumMember"
          ],
          format: [
            "camelCase",
            "PascalCase"
          ]
        },
        {
          selector: "objectLiteralMethod",
          modifiers: [
            "requiresQuotes"
          ],
          format: null
        }
      ],
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit"
        }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/member-ordering": "error",
      "@stylistic/member-delimiter-style": [
        "error",
        {
          multiline: {
            delimiter: "none",
            requireLast: true
          },
          singleline: {
            delimiter: "semi",
            requireLast: false
          }
        }
      ],
      "@stylistic/semi": [
        "error",
        "never"
      ],
      "@stylistic/block-spacing": "error",
      "@stylistic/space-before-blocks": [
        "error",
        "always"
      ],
      "@stylistic/space-in-parens": [
        "error",
        "always"
      ],
      "@stylistic/space-before-function-paren": [
        "error",
        {
          anonymous: "always",
          named: "always",
          asyncArrow: "always"
        }
      ],
      "@stylistic/keyword-spacing": [
        "error",
        {
          before: true,
          after: true,
        },
      ],
      "@stylistic/func-call-spacing": [
        "error",
        "always"
      ],
      "@stylistic/array-bracket-spacing": [
        "error",
        "always"
      ],
      "@stylistic/object-curly-spacing": [
        "error",
        "always"
      ],
      "@stylistic/quotes": [
        "error",
        "double",
        {
          avoidEscape: true,
          allowTemplateLiterals: true
        }
      ],
      "@stylistic/indent": [
        "error",
        2,
        {
          SwitchCase: 1,
          FunctionDeclaration: {
            body: 1,
            parameters: "first"
          },
          FunctionExpression: {
            body: 1,
            parameters: "first"
          }
        }
      ],
      "@stylistic/arrow-parens": [
        "error",
        "as-needed"
      ],
      "@stylistic/max-len": [
        "error",
        {
          ignorePattern: "^import [^,]+ from |^export | implements",
          code: 150,
          tabWidth: 2,
          comments: 200,
          ignoreComments: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true
        }
      ],
      "@arrowFunction/prefer-arrow-functions": [
        "warn",
        {
          allowedNames: [],
          allowNamedFunctions: false,
          allowObjectProperties: false,
          classPropertiesAllowed: false,
          disallowPrototype: false,
          returnStyle: "unchanged",
          singleReturnOnly: false
        }
      ],
      "no-unused-vars": "off", // Turn standard rule off, use TypeScript version
      "no-unused-labels": "error"
    }
  },
  {
    files: [
      "*.html"
    ],
    extends: [
      ...angular.configs.templateAll,
    ],
    rules: {
      "@angular-eslint/template/prefer-self-closing-tags": "error",
      "@angular-eslint/template/prefer-control-flow": "error"
    }
  }
)