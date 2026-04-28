# HomeTest Service

The HomeTest Service is a service that provides a central hub for ordering home tests for NHS
patients.

This repository contains the full stack, including the frontend, backend lambdas, and
infrastructure-as-code.

## Table of Contents

- [HomeTest Service](#hometest-service)
  - [Table of Contents](#table-of-contents)
  - [Setup](#setup)
    - [Prerequisites](#prerequisites)
      - [mise](#mise)
      - [Local Secrets](#local-secrets)
  - [Usage](#usage)
    - [Local Development](#local-development)
    - [Common local workflows](#common-local-workflows)
    - [Frontend](#frontend)
    - [Local Infrastructure](#local-infrastructure)
  - [Testing](#testing)
  - [Design](#design)
    - [Architecture](#architecture)
  - [Contributing](#contributing)
  - [Licence](#licence)

## Setup

1. Clone the repository

   ```shell
   git clone https://github.com/NHSDigital/hometest-service.git
   cd hometest-service
   ```

2. [Install mise](https://mise.jdx.dev/installing-mise.html) (recommended package manager)

   ```shell
   curl https://mise.run | sh
   echo 'eval "$(mise activate zsh)"' >> ~/.zshrc  # or ~/.bashrc for bash
   source ~/.zshrc
   ```

3. Install project dependencies using mise

   ```shell
   mise install  # Installs Node.js and Terraform versions from .mise.toml
   ```

4. Install dependencies for the root, lambdas, and tests, start the local development environment

   ```shell
   pnpm install
   pnpm run start
   ```

### Prerequisites

The following software packages, or their equivalents, are expected to be installed and configured:

- [Docker](https://www.docker.com/)
- [Node v24](https://nodejs.org/en) LTS,
- A tool version manager:
  - [nvm](https://github.com/nvm-sh/nvm) version manager. This repository contains a [`.nvmrc`](./.nvmrc) file, to make the runtime version consistent.
  - [mise](https://mise.jdx.dev) (reads [`.mise.toml`](./.mise.toml))
- [Terraform](https://developer.hashicorp.com/terraform). The version is specified in [.tool-versions].
  - Local development uses Terraform to deploy to LocalStack.

#### mise

Mise can read the `.nvmrc` file by following the [instructions](https://mise.jdx.dev/configuration.html#idiomatic-version-files).

Important commands:

```shell
pre-commit install # Enables the git hook to run the checks locally on commit
mise run pre-commit   # Run the pre-commit task defined in .mise.toml
```

#### Local Secrets

Before starting, ensure the following files are present in
`local-environment/infra/resources/secrets/`.

> [!WARNING]
> These files contain sensitive credentials. They must never be committed to git or shared in
> plaintext. Obtain them only through a team-approved secure channel.

- `nhs-login-private-key.pem` — NHS Login private key
- `os-places-creds.json` — OS Places API credentials

## Usage

### Local Development

To spin up the entire local environment (LocalStack, Postgres, and the Next.js Frontend):

```shell
pnpm start
```

This command:

1. Starts the Docker containers defined in [`local-environment/docker-compose.yml`](./local-environment/docker-compose.yml).
2. Bootstraps LocalStack [via Terraform](local-environment/infra), and deploys the lambdas to it from the `/lambdas` directory.
3. Starts the frontend on [http://localhost:3000](http://localhost:3000).

To stop the environment:

```shell
pnpm run stop
```

### Common local workflows

After running `pnpm start`, use targeted commands instead of restarting everything:

- **Lambda code changes** (build/package/deploy lambdas to LocalStack):

  ```shell
  pnpm run local:deploy
  ```

- **Database schema or seed changes** (rerun goose migrations and seed data):

  ```shell
  pnpm run local:service:db:migrate
  ```

- **Terraform infrastructure changes** (apply infra updates to LocalStack without restarting containers):

  ```shell
  pnpm run local:terraform:apply
  ```

  This expects the backend containers, including LocalStack, to already be running. If they are not, start them first:

  ```shell
  pnpm run local:backend:start
  ```

  To switch local integrations between WireMock and real upstreams, pass Terraform variables when applying - some examples below.

  To only use WireMock everywhere (default mode - only needed to switch over):

  ```shell
  TF_VAR_local_service_mode=wiremock pnpm run local:terraform:apply # this is the default mode, only needed to switch over
  ```

  To not use WireMock anywhere (real downstream APIs):

  ```shell
  TF_VAR_local_service_mode=real pnpm run local:terraform:apply
  ```

  To use WireMock except for specific services, pass only the overrides you need:

  ```shell
  TF_VAR_local_service_mode=wiremock \
  TF_VAR_local_supplier_service_url_override=https://supplier.example.com \
  TF_VAR_local_use_ui_auth_url_override=https://auth.sandpit.signin.nhs.uk \
  TF_VAR_local_postcode_lookup_base_url_override=https://api.os.uk/search/places/v1 \
  pnpm run local:terraform:apply # pnpm run local:frontend:restart - if overriding UI auth
  ```

  If you change UI-facing auth settings, restart the frontend so it picks up the updated `ui/.env.local` values:

  ```shell
  pnpm run local:frontend:restart
  ```

- **Restart backend containers only** (Postgres, LocalStack, WireMock):

  ```shell
  pnpm run local:compose -- stop postgres-db localstack wiremock
  pnpm run local:backend:start
  ```

- **Restart frontend only**:

  ```shell
  pnpm run local:frontend:restart
  ```

- **Start/stop backend only**:

  ```shell
  pnpm run local:backend:start
  pnpm run local:compose -- stop postgres-db localstack wiremock
  ```

- **Start/stop frontend only**:

  ```shell
  pnpm run local:frontend:start
  pnpm run local:compose -- stop ui
  ```

- **Start/stop specified lambda**

  ```shell
  LAMBDA={lambda_name} pnpm run local:service:lambda:enable
  LAMBDA={lambda_name} pnpm run local:service:lambda:disable
  ```

### Frontend

The frontend is located in the `/ui` directory. It is a **React Router SPA** built with Next.js as
a static-export shell — not a standard Next.js application.

1. cd to `/ui` directory.
2. Run `pnpm install`.
3. Run `pnpm run dev`.

- When creating a new page, use the PageLayout component found in `/ui/src/components`.
- To create a new route, create a directory with the name of your route in `/ui/src/app`, and add a `page.tsx` file within.
- All route/page components live under `ui/src/routes/` and are registered in `ui/src/app.tsx`
  (the React Router config).
- Layout components live under `ui/src/layouts/`. Use these (e.g. `FormPageLayout`,
  `JourneyLayout`) when building new pages.
- Use components from `nhsuk-react-components` for standard NHS UI elements; use Tailwind utility
  classes for custom spacing and layout.
- **Never** use `next/link`, `next/navigation`, or Next.js API routes — all navigation goes
  through React Router and all backend logic lives in Lambda functions.

### Local Infrastructure

Local infrastructure is managed via Terraform in the [`/local-environment/infra`](./local-environment/infra) directory.

## Testing

We use [Playwright](https://playwright.dev/) for end-to-end testing, located in the `/tests`
directory.

## Design

### Architecture

The service follows a serverless-first architecture on AWS:

- **Frontend**: Next.js (React)
- **Backend**: AWS Lambda (Node.js/TypeScript)
- **Database**: PostgreSQL (managed via Docker locally)
- **Infrastructure**: Terraform

System diagrams and design documents can be found in the [`/docs`](./docs) and [`/architecture`](./architecture) folders.

## Contributing

View the [contributing guidelines](./CONTRIBUTING.md).

## Licence

> The [LICENCE.md](./LICENCE.md) file will need to be updated with the correct year and owner

Unless stated otherwise, the codebase is released under the MIT License. This covers both the
codebase and any sample code in the documentation.

Any HTML or Markdown documentation
is [© Crown Copyright](https://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/crown-copyright/)
and available under the terms of
the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
