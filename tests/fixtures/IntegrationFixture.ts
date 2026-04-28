import { mergeTests } from "@playwright/test";

import { dbFixture } from "./DbFixture";
import { apiFixture } from "./apiFixture";
import { configurationFixture } from "./configurationFixture";
import { lambdaFixture } from "./lambdaFixture";
import { logContextFixture } from "./logContextFixture";
import { testDataFixture } from "./testDataFixture";

export const test = mergeTests(
  configurationFixture,
  apiFixture,
  dbFixture,
  lambdaFixture,
  logContextFixture,
  testDataFixture,
);
export { expect } from "@playwright/test";
