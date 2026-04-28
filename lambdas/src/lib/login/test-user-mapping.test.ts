import { type INhsUserInfoResponseModel } from "../models/nhs-login/nhs-login-user-info-response-model";
import { enrichUserInfoWithTestFirstName } from "./test-user-mapping";

function createUserInfo(
  overrides: Partial<INhsUserInfoResponseModel> = {},
): INhsUserInfoResponseModel {
  const defaults: INhsUserInfoResponseModel = {
    iss: "https://issuer.example",
    aud: "hometest",
    sub: "user-123",
    family_name: "MILLAR",
    given_name: "",
    identity_proofing_level: "P9",
    email: "test.user@example.com",
    email_verified: "true",
    phone_number: "+447700900123",
    phone_number_verified: "true",
    birthdate: "1990-01-01",
    nhs_number: "9999999999",
    gp_registration_details: {
      gp_ods_code: "A12345",
    },
  };

  return {
    ...defaults,
    ...overrides,
  };
}

describe("enrichUserInfoWithTestFirstName", () => {
  it("returns same object when given_name is already present", () => {
    const userInfo = createUserInfo({ given_name: "Existing", family_name: "MILLAR" });

    const result = enrichUserInfoWithTestFirstName(userInfo);

    expect(result).toBe(userInfo);
    expect(result.given_name).toBe("Existing");
  });

  it("adds given_name for mapped test users when missing", () => {
    const userInfo = createUserInfo({ given_name: "", family_name: "MILLAR" });

    const result = enrichUserInfoWithTestFirstName(userInfo);

    expect(result).not.toBe(userInfo);
    expect(result.given_name).toBe("Mona");
    expect(result.family_name).toBe("MILLAR");
  });

  it("returns same object when family_name is not mapped and given_name is missing", () => {
    const userInfo = createUserInfo({ given_name: "", family_name: "UNKNOWN" });

    const result = enrichUserInfoWithTestFirstName(userInfo);

    expect(result).toBe(userInfo);
    expect(result.given_name).toBe("");
    expect(result.family_name).toBe("UNKNOWN");
  });
});
