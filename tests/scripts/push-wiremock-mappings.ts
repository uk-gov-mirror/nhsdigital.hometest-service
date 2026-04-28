#!/usr/bin/env node
/**
 * Push all baseline WireMock mappings to a running WireMock instance.
 *
 * Resets existing mappings first, then pushes:
 *   - NHS Login auth stubs (JWKS, /authorize, /token, /userinfo)
 *   - Supplier stubs (OAuth token, order placement)
 *   - OS Places postcode-lookup stub (wildcard catch-all)
 *
 * Usage:
 *   WIREMOCK_BASE_URL=https://wiremock-uat.poc.hometest.service.nhs.uk \
 *   pnpm exec tsx scripts/push-wiremock-mappings.ts
 *
 * Or via the pnpm script:
 *   WIREMOCK_BASE_URL=https://wiremock-uat.poc.hometest.service.nhs.uk \
 *   pnpm run wiremock:push
 *
 * Environment variables:
 *   WIREMOCK_BASE_URL    Base URL of the WireMock instance (default: http://localhost:8080).
 *   WIREMOCK_JWT_ISSUER  Value used as the JWT `iss` claim (default: WIREMOCK_BASE_URL).
 *                        For local Docker this is typically http://wiremock:8080 (Docker-internal).
 */
import { WireMockClient } from "../api/clients/WireMockClient";
import {
  cleanupWireMockAuthState,
  configureWireMockAuthMappings,
  createWireMockAuthManifest,
  createWireMockCatchAllAuthorizeMapping,
  getWireMockAuthManifestPath,
} from "../utils/users/wiremockAuthMappings";
import { createWireMockUserInfoMapping } from "../utils/users/wiremockUserInfoMapping";
import { createOSPlacesCatchAllMapping } from "../utils/wireMockMappings/OSPlacesWireMockMappings";
import { createSupplierOAuthTokenMapping } from "../utils/wireMockMappings/SupplierOAuthWireMockMappings";
import { createSupplierOrderSuccessMapping } from "../utils/wireMockMappings/SupplierOrderWireMockMappings";

const wiremockBaseUrl = process.env.WIREMOCK_BASE_URL ?? "http://localhost:8080";
const wiremockJwtIssuer = process.env.WIREMOCK_JWT_ISSUER ?? wiremockBaseUrl;

async function main(): Promise<void> {
  console.log(`Pushing WireMock mappings to: ${wiremockBaseUrl}`);
  console.log(`JWT issuer: ${wiremockJwtIssuer}`);

  const wiremock = new WireMockClient(wiremockBaseUrl);

  cleanupWireMockAuthState();
  const manifest = createWireMockAuthManifest(wiremockJwtIssuer);

  // Reset + push NHS Login OAuth stubs (JWKS, /authorize redirects, /token exchanges)
  await configureWireMockAuthMappings(wiremock, manifest);

  // Push /userinfo stubs per user
  const allUsers = [...manifest.workerUsers, ...Object.values(manifest.specialUsers)];
  for (const user of allUsers) {
    await wiremock.createMapping(
      createWireMockUserInfoMapping(
        user,
        user.authContext.accessToken,
        user.authContext.sub,
        wiremockJwtIssuer,
      ),
    );
  }

  // Catch-all /authorize fallback for real browser navigation (no login_hint sent).
  // Uses the first worker user so a manual visit to the site completes the auth flow.
  await wiremock.createMapping(createWireMockCatchAllAuthorizeMapping(manifest.workerUsers[0]));

  // Push static supplier stubs
  await wiremock.createMapping(createSupplierOAuthTokenMapping());
  await wiremock.createMapping(createSupplierOrderSuccessMapping());

  // Push catch-all OS Places postcode lookup stub
  await wiremock.createMapping(createOSPlacesCatchAllMapping());

  console.log(
    `✅ Pushed mappings: ${allUsers.length} users (auth + userinfo), supplier stubs, OS Places catch-all`,
  );
  console.log(`   Auth manifest: ${getWireMockAuthManifestPath()}`);
  console.log(`   JWT issuer:    ${wiremockJwtIssuer}`);
}

main().catch((err: unknown) => {
  console.error("❌ Failed to push WireMock mappings:", err);
  process.exit(1);
});
