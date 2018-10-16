const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  "extends": "airbnb-base",
  rules: {
    "no-plusplus": OFF,
    "radix": OFF,
  },
  overrides: [
    {
      files: [
        "**/*.test.js"
      ],
      env: {
        jest: true,
      },
      // Can't extend in overrides: https://github.com/eslint/eslint/issues/8813
      // "extends": ["plugin:jest/recommended"]
      plugins: ["jest"],
      rules: {
        "jest/no-disabled-tests": "warn",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/prefer-to-have-length": "warn",
        "jest/valid-expect": "error"
      },
    },
  ],
};
