# WireMock Supplier API Mock

This directory contains WireMock stub mappings that mock the HomeTest Supplier Integration API for local development and testing.

## Table of Contents

- [WireMock Supplier API Mock](#wiremock-supplier-api-mock)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Usage](#usage)
  - [Testing](#testing)
    - [Prerequisites](#prerequisites)
    - [Running Postman Tests](#running-postman-tests)
    - [Configuration](#configuration)

## Overview

The WireMock service provides mock responses for the Supplier API, simulating the behavior of a real supplier system. This includes:

- **OAuth 2.0 Token Endpoint**: Mocks the OAuth token generation with various error scenarios
- **Order Endpoint**: Simulates successful order creation and validation errors
- **Results Endpoint**: Mocks result retrieval with success and not-found scenarios

The mock mappings are located in the [`mappings`](./mappings) directory.

## Usage

The WireMock service is started automatically when you run:

```shell
pnpm start
```

This command starts the WireMock container along with the rest of the local environment. The service is available at [http://localhost:8080](http://localhost:8080).

## Testing

### Prerequisites

To test the WireMock API stubs, you'll need:

- [Postman](https://www.postman.com/downloads/) or Newman (Postman CLI)
- The Supplier Contract Postman collection from the [hometest-supplier-integration-framework](https://github.com/NHSDigital/hometest-supplier-integration-framework) repository (currently on the `feature/initial-api-schemas` branch)

### Running Postman Tests

1. Import the Supplier Contract collection from supplier integration framework - latest [here](https://github.com/NHSDigital/hometest-supplier-integration-framework/blob/feature/initial-api-schemas/tests/postman/collections/supplier-contract.postman_collection.json).

2. Configure the collection-level environment variables in Postman.

### Configuration

Set the following environment variable at the collection level in Postman:

| Variable | Value |
|----------|-------|
| `supplier_base_url` | `http://localhost:8080` |

This ensures that all requests in the collection are directed to the local WireMock instance.
