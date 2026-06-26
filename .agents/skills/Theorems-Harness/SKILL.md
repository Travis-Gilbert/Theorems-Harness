```markdown
# Theorems-Harness Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development conventions and workflows used in the Theorems-Harness TypeScript codebase. You'll learn how to structure files, write imports and exports, follow commit message standards, and organize and run tests. These patterns help maintain consistency and quality across the project.

## Coding Conventions

### File Naming
- **Style:** kebab-case
- **Example:**  
  ```
  theorem-utils.ts
  proof-engine.test.ts
  ```

### Import Style
- **Style:** Mixed (both relative and absolute imports may be used)
- **Example:**
  ```typescript
  import { proveTheorem } from './theorem-utils';
  import { Engine } from 'theorems-core';
  ```

### Export Style
- **Style:** Named exports
- **Example:**
  ```typescript
  // theorem-utils.ts
  export function proveTheorem() { ... }

  export const THEOREM_VERSION = '1.0';
  ```

### Commit Messages
- **Type:** Conventional commits
- **Prefix:** `feat`
- **Average Length:** ~47 characters
- **Example:**
  ```
  feat: add proof validation for new theorem types
  ```

## Workflows

### Add a New Feature
**Trigger:** When implementing a new capability or module  
**Command:** `/add-feature`

1. Create a new file using kebab-case (e.g., `new-feature.ts`).
2. Write your code using named exports.
3. Import dependencies using mixed import style as needed.
4. Write or update corresponding test files (`new-feature.test.ts`).
5. Commit your changes using the conventional commit format:
   ```
   feat: short description of the feature
   ```
6. Push your branch and open a pull request.

### Write and Run Tests
**Trigger:** When adding or updating code that requires validation  
**Command:** `/run-tests`

1. Create or update test files matching the pattern `*.test.ts`.
2. Write tests for all new or changed functionality.
3. Use the project's test runner (framework unknown; check project scripts or documentation).
4. Run the tests locally and ensure they pass.
5. Commit test changes with a descriptive message.

## Testing Patterns

- **Test File Naming:**  
  Use the pattern `*.test.ts` for test files.
  ```
  theorem-utils.test.ts
  proof-engine.test.ts
  ```
- **Framework:**  
  Not explicitly detected; check for scripts or dependencies to determine the runner.
- **Placement:**  
  Test files are typically located alongside the code they test or in a dedicated test directory.

## Commands
| Command       | Purpose                                         |
|---------------|-------------------------------------------------|
| /add-feature  | Scaffold and commit a new feature/module        |
| /run-tests    | Run all tests in the codebase                   |
```
