# Lambda Functions

This directory contains all AWS Lambda functions for the project.
Each Lambda is organised as a subdirectory within the shared `src/` folder.

## Structure

```text
lambdas/
 ├── src/
 │   ├── some-lambda/
 │   │   ├── index.ts
 │   │   └── [other files]
 │   ├── another-lambda/
 │   │   ├── index.ts
 │   │   └── [other files]
 │   └── lib # shared code
 └── package.json
```

## Development Rules

### Directory Naming

- All Lambdas must be direct subdirectories of `src/`
- Lambda directory names must end with `-lambda` suffix
- Each Lambda directory contains its handler and related code

### Dependencies

- Shared `package.json` at the root level for all Lambdas
- All dependencies are managed centrally

### Build Process

- Each Lambda is built independently using `esbuild`
- TypeScript source code is compiled and bundled into a single JavaScript file
- Output is optimised for AWS Lambda runtime (Node.js 24.x)
- Build targets `src/{lambda-name}/index.ts` as entry point
- To run the build process, run `pnpm run build`
- An individual Lambda can be built by running `pnpm run build -- --lambda {lambda-name}`

### Packaging Process

- Each Lambda is packaged as a ZIP archive
- The archives can be found in the `dist/` directory
- To create the ZIP archives, run `pnpm run package`
- An individual Lambda can be packaged by running `pnpm run package -- --lambda {lambda-name}`

### Local Deployment

- Lambdas are deployed via Terraform using `archive_file` data source
- To deploy all Lambdas, run `pnpm run local:terraform:apply`
  - This is a wrapper for the script with the same name in the root `package.json`
- Each Lambda gets its own IAM role with minimal required permissions

### Local Development

- Use LocalStack for local testing
- Deploy via Terraform: `pnpm run local:terraform:apply`
- Functions are available at `http://localhost:4566`

### Invoking Lambdas via AWS CLI

You can invoke a Lambda directly against LocalStack using the AWS CLI. Lambdas that are triggered via API Gateway expect an `APIGatewayProxyEvent` shape, so the payload must include a `headers` object and a `body` string.

**Example — invoking `hometest-service-hiv-results-processor`:**

```bash
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws lambda invoke \
  --function-name hometest-service-hiv-results-processor \
  --payload '{"headers":{"x-correlation-id":"550e8400-e29b-41d4-a716-446655440008"},"body":"{\"resourceType\":\"Observation\",\"id\":\"550e8400-e29b-41d4-a716-446655440001\",\"basedOn\":[{\"reference\":\"ServiceRequest/caaf11c4-96b1-4e92-adc2-5caae9c7732d\"}],\"status\":\"final\",\"code\":{\"coding\":[{\"system\":\"http://snomed.info/sct\",\"code\":\"31676001\",\"display\":\"HIV antigen test\"}],\"text\":\"HIV antigen test\"},\"subject\":{\"reference\":\"Patient/68db68d4-8d71-4a76-9988-d55e9bef99d4\"},\"effectiveDateTime\":\"2025-11-04T15:45:00Z\",\"issued\":\"2025-11-04T16:00:00Z\",\"performer\":[{\"reference\":\"Organization/c1a2b3c4-1234-4def-8abc-123456789abc\",\"type\":\"Organization\",\"display\":\"Supplier Organization Name\"}],\"interpretation\":[{\"coding\":[{\"system\":\"http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation\",\"code\":\"N\",\"display\":\"Normal\"}],\"text\":\"Normal\"}],\"valueCodeableConcept\":{\"coding\":[{\"system\":\"http://snomed.info/sct\",\"code\":\"260415000\",\"display\":\"Not detected\"}]}}"}' \
  --cli-binary-format raw-in-base64-out \
  --endpoint-url http://localhost:4566 \
  --region eu-west-2 \
  response.json
```

The response is written to `response.json`. Key points:

- `headers` — must include `x-correlation-id` as a valid UUID; the handler will throw if it is missing or invalid.
- `body` — the FHIR Observation resource serialised as a JSON string (escaped).
- `AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test` — dummy credentials required by LocalStack.

### Best Practices

- Keep handler functions small and focused
- Use environment variables for configuration
- Include proper error handling and logging
- Follow the single responsibility principle per Lambda
- Each Lambda must have an `index.ts` file with the main handler

## Testing

### Unit Tests

Unit tests use mocked dependencies and run quickly without external services.

```bash
# Run all unit tests (excludes integration tests)
pnpm run test:unit

# Run tests in watch mode
pnpm run test:watch

# Run with coverage
pnpm run test:coverage
```

### Integration Tests

Integration tests use real services (PostgreSQL via Docker) to verify infrastructure behavior that cannot be reliably mocked.

**Testing Philosophy:**

- Test infrastructure layers (e.g., `DBClient`) that directly interact with external systems
- Verify actual database behavior: transactions (BEGIN/COMMIT/ROLLBACK), constraints, SQL correctness
- Do NOT duplicate tests already covered by unit tests
- Business logic layers (e.g., `SupplierService`) are tested via unit tests that mock their dependencies

**Current Integration Tests:**

- `db-client.integration.test.ts` - Verifies PostgreSQL transaction atomicity, isolation, rollback behavior

**Prerequisites:**

- Docker must be running
- Tests will automatically pull and start PostgreSQL containers

```bash
# Run only integration tests
pnpm run test:integration

# Run all tests (unit + integration)
pnpm test
```

**Note:** Integration tests are slower (~10-30s startup) but provide confidence that infrastructure components work correctly with real external systems.
