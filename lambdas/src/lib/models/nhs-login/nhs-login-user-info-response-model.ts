export interface INhsUserInfoResponseModel {
  iss: string;
  aud: string;
  sub: string;
  family_name: string;
  given_name: string;
  identity_proofing_level: string;
  email: string;
  email_verified: string;
  phone_number: string;
  phone_number_verified: string;
  birthdate: string;
  nhs_number: string;
  gp_registration_details: INhsUserInfoGpRegistrationDetails;
}

export interface INhsUserInfoGpRegistrationDetails {
  gp_ods_code: string;
}
