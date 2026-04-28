import { TestDataFactory } from "../utils/TestDataFactory";
import { dbFixture } from "./DbFixture";

type TestDataFixtures = {
  testData: TestDataFactory;
};

export const testDataFixture = dbFixture.extend<TestDataFixtures>({
  testData: async ({ testOrderDb }, use) => {
    const factory = new TestDataFactory(testOrderDb);
    await use(factory);
    await factory.cleanup();
  },
});
