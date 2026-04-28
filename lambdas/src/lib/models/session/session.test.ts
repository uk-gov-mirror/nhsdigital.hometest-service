import { type INhsUserInfoResponseModel } from "../nhs-login/nhs-login-user-info-response-model";
import {
  type ISessionUserInfo,
  mapNhsUserInfoToSessionUserInfo,
  mapSessionUserInfoToNhsUserInfo,
} from "./session";

function createNhsUserInfo(
  overrides: Partial<INhsUserInfoResponseModel> = {},
): INhsUserInfoResponseModel {
  const defaults: INhsUserInfoResponseModel = {
    iss: "https://issuer.example",
    aud: "hometest",
    sub: "user-123",
    family_name: "MILLAR",
    given_name: "Mona",
    identity_proofing_level: "P9",
    email: "test.user@example.com",
    email_verified: "true",
    phone_number: "+447700900123",
    phone_number_verified: "false",
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

function createSessionUserInfo(overrides: Partial<ISessionUserInfo> = {}): ISessionUserInfo {
  return {
    issuer: "https://issuer.example",
    audience: "hometest",
    subject: "user-123",
    familyName: "MILLAR",
    givenName: "Mona",
    identityProofingLevel: "P9",
    email: "test.user@example.com",
    emailVerified: true,
    phoneNumber: "+447700900123",
    phoneNumberVerified: false,
    birthDate: "1990-01-01",
    nhsNumber: "9999999999",
    gpOdsCode: "A12345",
    ...overrides,
  };
}

describe("mapNhsUserInfoToSessionUserInfo", () => {
  it("maps NHS user info to the internal session user info model", () => {
    const userInfo = createNhsUserInfo();

    const result = mapNhsUserInfoToSessionUserInfo(userInfo);

    expect(result).toEqual({
      issuer: "https://issuer.example",
      audience: "hometest",
      subject: "user-123",
      familyName: "MILLAR",
      givenName: "Mona",
      identityProofingLevel: "P9",
      email: "test.user@example.com",
      emailVerified: true,
      phoneNumber: "+447700900123",
      phoneNumberVerified: false,
      birthDate: "1990-01-01",
      nhsNumber: "9999999999",
      gpOdsCode: "A12345",
    });
  });

  it("throws when a verification flag is not a supported NHS Login value", () => {
    const userInfo = createNhsUserInfo({ email_verified: "yes" });

    expect(() => mapNhsUserInfoToSessionUserInfo(userInfo)).toThrow(
      "Unexpected verification flag value: yes",
    );
  });
});

describe("mapSessionUserInfoToNhsUserInfo", () => {
  it("maps internal session user info to the NHS user info model", () => {
    const userInfo = createSessionUserInfo();

    const result = mapSessionUserInfoToNhsUserInfo(userInfo);

    expect(result).toEqual({
      iss: "https://issuer.example",
      aud: "hometest",
      sub: "user-123",
      family_name: "MILLAR",
      given_name: "Mona",
      identity_proofing_level: "P9",
      email: "test.user@example.com",
      email_verified: "true",
      phone_number: "+447700900123",
      phone_number_verified: "false",
      birthdate: "1990-01-01",
      nhs_number: "9999999999",
      gp_registration_details: {
        gp_ods_code: "A12345",
      },
    });
  });
});
