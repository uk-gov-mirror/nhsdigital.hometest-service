import { type INhsUserInfoResponseModel } from "../nhs-login/nhs-login-user-info-response-model";

export interface ISessionUserInfo {
  issuer: string;
  audience: string;
  subject: string;
  familyName: string;
  givenName: string;
  identityProofingLevel: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
  phoneNumberVerified: boolean;
  birthDate: string;
  nhsNumber: string;
  gpOdsCode: string;
}

function parseVerificationFlag(value: string): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Unexpected verification flag value: ${value}`);
}

function toVerificationFlag(value: boolean): "true" | "false" {
  return value ? "true" : "false";
}

export function mapNhsUserInfoToSessionUserInfo(
  userInfo: INhsUserInfoResponseModel,
): ISessionUserInfo {
  return {
    issuer: userInfo.iss,
    audience: userInfo.aud,
    subject: userInfo.sub,
    familyName: userInfo.family_name,
    givenName: userInfo.given_name,
    identityProofingLevel: userInfo.identity_proofing_level,
    email: userInfo.email,
    emailVerified: parseVerificationFlag(userInfo.email_verified),
    phoneNumber: userInfo.phone_number,
    phoneNumberVerified: parseVerificationFlag(userInfo.phone_number_verified),
    birthDate: userInfo.birthdate,
    nhsNumber: userInfo.nhs_number,
    gpOdsCode: userInfo.gp_registration_details.gp_ods_code,
  };
}

export function mapSessionUserInfoToNhsUserInfo(
  userInfo: ISessionUserInfo,
): INhsUserInfoResponseModel {
  return {
    iss: userInfo.issuer,
    aud: userInfo.audience,
    sub: userInfo.subject,
    family_name: userInfo.familyName,
    given_name: userInfo.givenName,
    identity_proofing_level: userInfo.identityProofingLevel,
    email: userInfo.email,
    email_verified: toVerificationFlag(userInfo.emailVerified),
    phone_number: userInfo.phoneNumber,
    phone_number_verified: toVerificationFlag(userInfo.phoneNumberVerified),
    birthdate: userInfo.birthDate,
    nhs_number: userInfo.nhsNumber,
    gp_registration_details: {
      gp_ods_code: userInfo.gpOdsCode,
    },
  };
}

export interface ISession {
  sessionId: string;
  refreshTokenId: string;
  nhsAccessToken: string;
  userInfo: ISessionUserInfo;
  sessionCreatedAt: string;
  lastRefreshAt: string;
  maxExpiresAt: string;
}
