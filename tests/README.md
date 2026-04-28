# Playwright Test Framework

This directory contains the Playwright test framework for the hometest-service project.

## Setup

1. Install dependencies:

   ```bash
   cd tests
   pnpm install
   pnpm exec playwright install
   ```

2. Install browser binaries (if needed):

   ```bash
   pnpm exec playwright install chromium firefox webkit
   ```

3. Set up local user credentials (for local testing only):

   The `users.ts` file should already exist in the tests directory with your local test user configuration.

   **Note**: The `users.ts` file is ignored by Git, so your credentials remain private. This configuration is only used when `ENV=local`.

   For detailed information about user management, see the [User Management for Local Environment](#user-management-for-local-environment) section.

## Running Tests

- Run all tests:

  ```bash
  ENV=local pnpm exec playwright test
  ```

- Run tests in headed mode (with browser UI):

  ```bash
  ENV=local pnpm exec playwright test:headed
  ```

- Run tests in debug mode:

  ```bash
  ENV=local pnpm exec playwright test:debug
  ```

## Project Structure

```tree
test/
├── package.json           # Node.js dependencies and scripts
├── playwright.config.ts   # Playwright configuration
├── tests/                 # Test files
│   └── example.spec.ts    # Example test suite
├── test-results/          # Test results (generated)
└── README.md              # This file
```

## Writing Tests

Tests should be placed in the `tests/` directory with the `.spec.ts` extension.

Example test structure:

```typescript
import { expect, test } from "@playwright/test";

test.describe("My Test Suite", () => {
  test("my test case", async ({ page }) => {
    await page.goto("https://example.com");
    await expect(page).toHaveTitle(/Example/);
  });
});
```

## Configuration

### Environment Configuration

The framework uses environment-based configuration management. You **must** set the `ENV` environment variable before running tests.

#### Required Environment Variable

Set the `ENV` variable to specify which environment to test against:

```bash
# Linux/macOS
export ENV=dev
pnpm test

# Or inline
ENV=dev pnpm test

# Windows (PowerShell)
$env:ENV="dev"
pnpm test
```

**If `ENV` is not set, tests will fail with an error.**

#### Environment Files

Environment-specific configuration is stored in `configuration/.env.<environment>`:

- `.env.dev` - Development configuration
- `.env.local` - Local configuration

Each file contains:

- `UI_BASE_URL` - Base URL for UI tests
- `API_BASE_URL` - Base URL for API tests
- `HEADLESS` - Run browser in headless mode (true/false)
- `WIREMOCK_BASE_URL` - Base WireMock URL
- `TIMEOUT` - Default timeout in milliseconds
- `SLOW_MO` - Slow down operations by specified milliseconds
- `AUTH_TYPE` - Authentication type: `wiremock` or `sandpit`

#### Using Configuration in Tests

Configuration is available through fixtures:

```typescript
import { EnvironmentVariables } from "../configuration";
import { expect, test } from "../fixtures";

test("example test", async ({ config }) => {
  const baseUrl = config.get(EnvironmentVariables.UI_BASE_URL);
  const headless = config.getBoolean(EnvironmentVariables.HEADLESS);
  const timeout = config.getNumber(EnvironmentVariables.TIMEOUT);

  console.log(`Testing on: ${baseUrl}`);
  console.log(`Current environment: ${config.getEnvironment()}`);
});
```

#### Adding New Configuration Variables

1. Add the key to `EnvironmentVariables` enum in `configuration/environment-variables.ts`
2. Add the variable to all `.env.*` files in `configuration/` directory
3. Optionally add a default value in the `Configuration` class constructor
4. Access the value using `config.get(EnvironmentVariables.YOUR_KEY)`

### User Management for Local Environment

The framework uses different user management strategies depending on the environment:

#### Environment-Based User Selection

- **Local Environment (`ENV=local`)**: Uses the user configuration from `users.ts` (ignored file)
- **dev/Staging Environments**: Uses preconfigured NHS Login sandbox users

#### Setting Up Local Users

When running tests locally (`ENV=local`), you need to configure your test user credentials:

1. **Create the users.ts file**:

   The `users.ts` file should already exist in the tests directory. If not, create it with the following structure:

   ```typescript
   import type { NHSLoginUser } from "./utils/users/BaseUser";

   export const localUser: NHSLoginUser = {
     email: "your-email@example.com",
     nhsNumber: "9999999999",
     odsCode: "YOUR_ODS_CODE",
     age: 49,
     otp: process.env.OTP as unknown as string,
     password: process.env.GENERIC_PASS as unknown as string,
     description: "eligible user - local environment",
     patientId: "your-patient-id-here",
   };
   ```

2. **Configure your local user**:

   Replace the placeholder values with your actual test user credentials:
   - `email`: Your NHS Login test email address
   - `nhsNumber`: Your NHS number (10 digits)
   - `odsCode`: Your ODS (Organisation Data Service) code
   - `age`: User age (must match eligibility criteria)
   - `patientId`: Your patient ID in the system
   - `otp` and `password`: These are read from environment variables `OTP` and `GENERIC_PASS`

3. **Set environment variables**:

   Set the required authentication environment variables by creating a `credentials.ts` file:

```typescript
export OTP="your-otp-secret"
export GENERIC_PASS="your-password"
```

#### How It Works

The `SandBoxUserManager` class automatically detects the environment:

```typescript
// From SandBoxUserManager.ts
if (env === "local") {
  const { localUser } = require("../../users");
  console.log("Using local environment user from users.ts");
  return [localUser];
}
```

When running tests with `ENV=local`, the framework:

1. Checks the environment variable
2. Loads the `localUser` from `users.ts`
3. Uses this user for all test authentication

**Note**: The `users.ts` file is ignored to protect your credentials. Never commit this file to version control.

#### Troubleshooting Local User Setup

If you encounter the error: `"users.ts file not found. Please create it based on users.ts.example"`:

1. Ensure `users.ts` exists in the `tests/` directory
2. Verify the file exports a `localUser` object with the correct structure
3. Check that all required fields are present
4. Ensure `ENV=local` is set before running tests

#### dev/Staging User Management

For dev and staging environments, the framework uses preconfigured NHS Login sandbox users. These are managed internally and don't require local configuration.

## Running Local Environment

The test framework supports two authentication modes for local development:

1. **WireMock** (Recommended for local development) - Fast, isolated testing with mocked authentication
2. **Sandpit** - Real NHS Login authentication flow using sandbox credentials

### Authentication Types

#### WireMock Authentication

WireMock provides a mock authentication server that simulates NHS Login without requiring real credentials or network calls. This is ideal for:

- Fast local development and testing
- Offline development
- Parallel test execution (supports 4 workers)
- Consistent test data

**Configuration:**

Run

pnpm start - as default it will build env with wiremocks

Set `AUTH_TYPE=wiremock` in `configuration/.env.local`:

**How It Works:**

- Test users are automatically generated with mocked authentication tokens
- Authentication state is stubbed in WireMock
- All NHS Login API calls are intercepted and mocked
- 4 parallel test workers can run simultaneously

#### Sandpit Authentication

Sandpit mode uses real NHS Login sandbox credentials for authentication. This is useful for:

- Testing the actual NHS Login integration
- Verifying real authentication flows
- End-to-end validation before deployment

**Configuration:**

Set `AUTH_TYPE=sandpit` in `configuration/.env.local`:

Run

pnpm start

when it finishes

```shell
cd hometest-service
TF_VAR_local_service_mode=wiremock \
TF_VAR_local_use_ui_auth_url_override=<https://auth.sandpit.signin.nhs.uk> \
pnpm run local:terraform:apply
```

**Prerequisites:**

1. Valid NHS Login sandbox credentials
2. Configured `users.ts` file with your test user
3. `credentials.ts` file with OTP and password environment variables
4. Internet connection for NHS Login API calls

### Playwright Configuration

The Playwright configuration is in [playwright.config.ts](playwright.config.ts). You can modify:

- `baseURL`: Set the base URL for your application
- `testDir`: Change the test directory
- `projects`: Add or remove browser configurations
- `webServer`: Configure local dev server to start before tests

## CI/CD Integration

The configuration automatically adjusts for CI environments:

- Retries: 2 retries on CI, 0 locally
- Workers: 1 worker on CI, unlimited locally
- ForbidOnly: Fails build if `test.only` is found in CI

## Pushing WireMock Mappings to UAT

Before running tests against the UAT environment, you need to push the baseline WireMock stubs (NHS Login auth, supplier, OS Places) to the remote WireMock instance.

### Prerequisites

- Node.js and npm installed
- Network access to the WireMock instance at `https://wiremock-uat.poc.hometest.service.nhs.uk`

### Push mappings

From the `tests/` directory:

```bash
WIREMOCK_BASE_URL=https://wiremock-uat.poc.hometest.service.nhs.uk npm run wiremock:push
```

This will:

1. Generate fresh RSA key pairs and JWTs for all test users
2. Reset all existing WireMock mappings
3. Push NHS Login stubs (JWKS, `/authorize`, `/token`, `/userinfo`)
4. Push supplier OAuth and order stubs
5. Push an OS Places postcode-lookup catch-all stub

### Environment variables

| Variable              | Description                       | Default                           |
| --------------------- | --------------------------------- | --------------------------------- |
| `WIREMOCK_BASE_URL`   | Base URL of the WireMock instance | `http://localhost:8080`           |
| `WIREMOCK_JWT_ISSUER` | Value used as the JWT `iss` claim | Falls back to `WIREMOCK_BASE_URL` |

For UAT, both the Lambda and the browser share the same public WireMock URL, so `WIREMOCK_JWT_ISSUER` does not need to be set explicitly. For local Docker, the default issuer is `http://wiremock:8080` (Docker-internal), which differs from the localhost URL used by the test runner.

### Running tests against UAT

After pushing mappings:

```bash
ENV=uat PLAYWRIGHT_HTML_OPEN=never npx playwright test --project=chromium --grep-invert @db
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)
