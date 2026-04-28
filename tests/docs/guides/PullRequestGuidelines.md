# Pull Request Guidelines

This guide outlines the best practices for creating and reviewing pull requests in the hometest-service project.

## Table of Contents

- [General PR Process](#general-pr-process)
- [GitHub Actions Checks](#github-actions-checks)
- [Code Quality Standards](#code-quality-standards)
- [Page Object Pattern](#page-object-pattern)
- [Test Specifications](#test-specifications)
- [Fixtures Usage](#fixtures-usage)

## General PR Process

### For All Team Members

- **Use the Same PR Process**: Both developers and QA/testers should follow the same pull request workflow
- **Commit-Level Reviews**: Reviewers should respond to each commit individually to mark when it is reviewed and done
- **Example Review Flow**:

  ```text
  Commit 1: "Add login page object"
  ✅ Reviewer: "Reviewed - looks good"

  Commit 2: "Add login tests"
  ✅ Reviewer: "Done - all tests passing"

  Commit 3: "Fix lint issues"
  ✅ Reviewer: "Approved"
  ```

### PR Checklist

Before submitting a PR, ensure:

- [ ] **Code compiles without errors** - Never commit code that doesn't compile
- [ ] **Run branch checks** - `check=branch` for all three checks (see [Check All Branch Changes](#6-check-all-branch-changes-before-opening-pr))
- [ ] All GitHub Actions checks pass (see [GitHub Actions Checks](#github-actions-checks))
- [ ] All code is used (no unused imports, variables, or functions)
- [ ] All tests pass locally
- [ ] Code follows project conventions
- [ ] PR description clearly explains what and why
- [ ] Each commit has a clear, descriptive message

### Critical Rule: Always Compile Before Committing

**NEVER commit code that does not compile.** This is a fundamental rule for all contributors.

#### Why This Matters

- ❌ Breaks the build for everyone on the team
- ❌ Blocks other developers from merging their work
- ❌ Wastes CI/CD resources and time
- ❌ Makes git history difficult to navigate (can't checkout old commits safely)
- ❌ Indicates changes weren't properly tested

#### How to Check

Before every commit, ensure your code compiles:

**For TypeScript/JavaScript projects:**

```bash
# In the root directory
pnpm run build

# Or check TypeScript compilation
pnpm exec tsc --noEmit

# For tests directory
cd tests
pnpm run build
# or
pnpm exec tsc --noEmit
```

**For Lambda functions:**

```bash
cd lambdas
pnpm run build
```

**For UI:**

```bash
cd ui
pnpm run build
```

#### Fixing Compilation Errors

If you see compilation errors:

1. **Read the error messages carefully** - TypeScript provides helpful error descriptions
2. **Fix all errors** - Don't ignore or suppress errors without good reason
3. **Run the build again** to verify
4. **Only commit once everything compiles**

**Example of compilation error:**

```bash
$ pnpm run build

src/test.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.

10     const age: number = "25";
       ~~~~~~~~~

Found 1 error in src/test.ts:10
```

**Fix it, then verify:**

```bash
$ pnpm run build
✓ Build completed successfully
```

#### IDE Integration

**Use your IDEs TypeScript integration** to catch errors before committing:

- VS Code: Shows red squiggly lines under errors
- Check the "Problems" panel (View → Problems)
- Fix all errors before committing

#### What If You Need to Commit Work-in-Progress?

If you absolutely need to save work that doesn't compile:

1. **Use a feature branch** - Never push non-compiling code to main/develop
2. **Mark it clearly** in commit message: `WIP: implementing feature X (does not compile)`
3. **Never open a PR** with non-compiling code
4. **Fix compilation** before merging or asking for review

## GitHub Actions Checks

All pull requests must pass automated checks before they can be merged. **Fix all failing checks before requesting a review.**

### Available Checks

The following checks run automatically on every PR:

1. **Check File Format** - Ensures consistent file formatting across the codebase
2. **Check Markdown Format** - Validates markdown files follow style guidelines
3. **Check English Usage** - Checks for inclusive language and style
4. **Scan Secrets** - Detects accidentally committed secrets or credentials
5. **Check Terraform Format** - Validates Terraform code formatting (if applicable)
6. **Unit Tests** - Runs all unit tests
7. **Lint Checks** - Validates code quality and style

### Running Checks Locally

**Always run these checks locally before pushing** to avoid failed CI builds.

#### 1. Check File Format

Ensures all files follow EditorConfig rules (indentation, line endings, etc.):

```bash
./scripts/githooks/check-file-format.sh
```

**Common issues:**

- Mixed line endings (CRLF vs LF)
- Incorrect indentation (tabs vs spaces)
- Missing final newline

#### 2. Check Markdown Format

Validates markdown files against linting rules:

```bash
./scripts/githooks/check-markdown-format.sh
```

**Common issues:**

- Missing blank lines around headings
- Inconsistent list indentation
- Incorrect heading hierarchy
- Missing alt text on images

**Manual fixes required** - review the output and fix each issue.

#### 3. Check English Usage

Uses Vale to check for inclusive language and writing style:

```bash
./scripts/githooks/check-english-usage.sh
```

**Common issues:**

- Non-inclusive terms (e.g., "whitelist/blacklist" → "allowlist/blocklist")
- Gendered pronouns without context
- Ableist language

**Manual fixes required** - replace flagged terms with inclusive alternatives.

#### 4. Scan Secrets

Detects accidentally committed secrets or API keys:

```bash
./scripts/githooks/scan-secrets.sh
```

**If secrets are detected:**

1. **Never** commit real secrets - remove them immediately
2. Use environment variables or secret management
3. Add false positives to `.gitleaksignore` if needed
4. Rotate any exposed credentials

#### 5. Run All Git Hooks

Run all checks at once (recommended before committing):

```bash
make githooks-run
```

Or configure automatic checks on commit:

```bash
make githooks-config
```

#### 6. Check All Branch Changes Before Opening PR

Before opening a pull request, verify all changes in your branch against the base branch:

```bash
# Check English usage for all changes in your branch
check=branch ./scripts/githooks/check-english-usage.sh

# Check markdown format for all changes in your branch
check=branch ./scripts/githooks/check-markdown-format.sh

# Check file format for all changes in your branch
check=branch ./scripts/githooks/check-file-format.sh
```

**What this does:**

- `check=branch` - Compares your current branch against `origin/main` (or the base branch)
- Checks **only the files you've modified** in your branch
- Catches issues before CI/CD runs
- Saves time by running locally first

**Quick command to run all three:**

```bash
check=branch ./scripts/githooks/check-english-usage.sh && \
check=branch ./scripts/githooks/check-markdown-format.sh && \
check=branch ./scripts/githooks/check-file-format.sh && \
echo "✅ All branch checks passed!"
```

This will stop at the first failing check, allowing you to fix issues one at a time.

### Fixing Failed CI Checks

If your PR has failing checks:

1. **Check the GitHub Actions logs** to see which check failed
2. **Run the failing check locally** using the commands above
3. **Fix all issues** reported by the check
4. **Commit and push the fixes**
5. **Verify the check passes** in the updated PR

#### Example: Fixing File Format Issues

```bash
# 1. Check what's wrong
./scripts/githooks/check-file-format.sh

# Output shows:
# tests/example.spec.ts:
#   5: Expected indentation of 2 spaces but found 4

# 2. Fix the file manually or use editor formatting

# 3. Verify the fix
./scripts/githooks/check-file-format.sh

# 4. Commit and push
git add tests/example.spec.ts
git commit -m "fix: correct indentation in example.spec.ts"
git push
```

#### Example: Fixing English Usage Issues

```bash
# 1. Check for issues
./scripts/githooks/check-english-usage.sh

# Output shows:
# docs/guide.md:
#   12:15: Use 'allow list' instead of 'whitelist'

# 2. Fix manually
# Change "whitelist" to "allow list" in the file

# 3. Verify
./scripts/githooks/check-english-usage.sh

# 4. Commit
git add docs/guide.md
git commit -m "docs: use inclusive language in guide"
git push
```

### Docker-based Checks

If you don't have tools installed locally (like `vale` or `gitleaks`), the scripts will automatically use Docker:

```bash
# Force Docker usage even if tools are installed locally
FORCE_USE_DOCKER=true ./scripts/githooks/check-english-usage.sh
```

### Pre-commit Hook (Recommended)

Set up automatic checks before each commit:

```bash
make githooks-config
```

This will:

- Run checks automatically when you commit
- Prevent commits with issues
- Save time by catching problems early

### Troubleshooting

**Check still failing after local fix?**

- Ensure you committed and pushed all changes
- Check you're on the latest commit: `git pull --rebase`
- Look at the full CI logs for additional context

**Can't reproduce issue locally?**

- Try using Docker: `FORCE_USE_DOCKER=true ./scripts/githooks/check-file-format.sh`
- Check you're using the same Node.js version as CI
- Verify you have the latest scripts: `git pull`

**Need to bypass a check temporarily?**

- Don't bypass checks in PRs - fix the issues instead
- For legitimate exceptions, discuss with the team first

## Code Quality Standards

### No Unused Code

Always remove unused code before submitting a PR:

❌ **Bad** - Unused imports and variables:

```typescript
import { BrowserContext, Locator, Page, expect } from "@playwright/test";

// BrowserContext unused
import { config } from "../configuration";
import { OldPage } from "./OldPage";

// Not used

const UNUSED_CONSTANT = "test"; // Never used

export class MyPage {
  readonly page: Page;
  private unusedLocator: Locator; // Declared but never used

  // ...
}
```

✅ **Good** - Only what's needed:

```typescript
import { Locator, Page } from "@playwright/test";

import { config } from "../configuration";

export class MyPage {
  readonly page: Page;

  // ...
}
```

## Page Object Pattern

### Locator Declaration

Always declare locators as `readonly` properties and initialize them in the constructor.

✅ **Correct Pattern**:

```typescript
import { Locator, Page } from "@playwright/test";

import { EnvironmentVariables, config } from "../configuration";

export class LoginPage {
  readonly page: Page;

  // Locators
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByRole("textbox", { name: "Username" });
    this.passwordInput = page.getByRole("textbox", { name: "Password" });
    this.loginButton = page.getByRole("button", { name: "Log in" });
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  async navigate(): Promise<void> {
    await this.page.goto(config.get(EnvironmentVariables.UI_BASE_URL));
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async getTitle(): Promise<string> {
    return await this.page.title();
  }
}
```

❌ **Incorrect** - Don't use inline locators:

```typescript
export class LoginPage {
  async login(username: string, password: string): Promise<void> {
    // BAD: Inline locators are harder to maintain
    await this.page.getByRole("textbox", { name: "Username" }).fill(username);
    await this.page.getByRole("textbox", { name: "Password" }).fill(password);
    await this.page.getByRole("button", { name: "Log in" }).click();
  }
}
```

### No Assertions in Page Objects

Page objects should only contain interactions and data retrieval. Assertions belong in test specifications.

❌ **Bad** - Assertions in page object:

```typescript
export class DashboardPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.locator("h1");
  }

  async verifyWelcomeMessage(expectedText: string): Promise<void> {
    // BAD: Don't put assertions in page objects
    await expect(this.welcomeMessage).toHaveText(expectedText);
  }
}
```

✅ **Good** - Return data for test to assert:

```typescript
export class DashboardPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.locator("h1");
  }

  async getWelcomeMessage(): Promise<string> {
    return (await this.welcomeMessage.textContent()) || "";
  }

  // Or simply expose the locator for the test to assert
  // Tests can do: await expect(dashboardPage.welcomeMessage).toHaveText('Welcome');
}
```

## Test Specifications

### Assertions in Tests

All assertions should be in the test specification files, not in page objects.

✅ **Good Pattern**:

```typescript
import { expect, test } from "../fixtures";

test.describe("Login Flow", () => {
  test("should successfully log in with valid credentials", async ({
    page,
    loginPage,
    dashboardPage,
  }) => {
    // Navigate to login page
    await loginPage.navigate();

    // Perform login
    await loginPage.login("testuser", "password123");

    // ASSERTIONS IN TEST, NOT PAGE OBJECT
    await expect(dashboardPage.welcomeMessage).toHaveText("Welcome, testuser");
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test("should show error with invalid credentials", async ({ loginPage }) => {
    await loginPage.navigate();
    await loginPage.login("invalid", "wrong");

    // ASSERTION IN TEST
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toHaveText("Invalid username or password");
  });
});
```

## Fixtures Usage

### Import Pattern

Always import page objects, accessibility module, and configuration through fixtures.

✅ **Correct** - Using fixtures:

```typescript
import { expect, test } from "../fixtures";

test("homepage accessibility", async ({ page, homePage, accessibility }) => {
  // homePage, accessibility are provided by fixtures
  await homePage.navigate();

  const hasViolations = await accessibility.runAccessibilityCheck(page, "homepage");
  expect(hasViolations).toBe(false);
});
```

❌ **Incorrect** - Direct imports:

```typescript
import { expect, test } from "@playwright/test";

import { HomePage } from "../page-objects/HomePage";
// Don't do this
import { AccessibilityModule } from "../utils";

// Don't do this

test("homepage test", async ({ page }) => {
  const homePage = new HomePage(page); // Don't instantiate manually
  // ...
});
```

### Fixture Setup Example

Reference the fixtures file to understand what's available:

```typescript
// tests/fixtures/index.ts
import { test as base } from "@playwright/test";

import { HomeStartTestPage, PlaywrightDevPage, WPHomePage } from "../page-objects";
import { AccessibilityModule } from "../utils";

type MyFixtures = {
  playwrightDevPage: PlaywrightDevPage;
  wpHomePage: WPHomePage;
  homeTestStartPage: HomeTestStartPage;
  accessibility: AccessibilityModule;
};

export const test = base.extend<MyFixtures>({
  playwrightDevPage: async ({ page }, use) => {
    await use(new PlaywrightDevPage(page));
  },
  wpHomePage: async ({ page }, use) => {
    await use(new WPHomePage(page));
  },
  homeTestStartPage: async ({ page }, use) => {
    await use(new HomeTestStartPage(page));
  },
  accessibility: async ({}, use) => {
    await use(new AccessibilityModule());
  },
});

export { expect } from "@playwright/test";
```

## Summary Checklist

When creating a PR, verify:

- [ ] **Code compiles without any errors** (`pnpm run build` succeeds)
- [ ] **Run branch checks** before opening PR (English usage, markdown format, file format)
- [ ] Using the same PR process as all team members
- [ ] Ready to respond to each commit during review
- [ ] **All GitHub Actions checks pass** (file format, markdown, English usage, secrets, tests)
- [ ] Run `make githooks-run` locally before pushing
- [ ] No unused imports, variables, or code
- [ ] Locators declared as `readonly` and initialized in constructor
- [ ] No assertions in page objects
- [ ] All assertions in test specifications
- [ ] Using fixtures to import page objects and utilities
- [ ] All tests pass locally
- [ ] Code follows project conventions

## References

- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Pattern](https://playwright.dev/docs/pom)
