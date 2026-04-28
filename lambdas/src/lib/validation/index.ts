import { ErrorStatusCode } from "../fhir-response";

export interface ValidationError {
  errorCode: ErrorStatusCode;
  errorType: "not-found" | "invalid" | "forbidden" | "conflict";
  errorMessage: string;
  severity: "error" | "warning" | "information";
}

export type ValidationResult<T = void> = ValidationResultSuccess<T> | ValidationResultError;

export type ValidationResultSuccess<T> = {
  success: true;
  data: T;
  error?: never;
};

export type ValidationResultError = {
  success: false;
  data?: never;
  error: ValidationError;
};

export function successResult(): ValidationResult<void>;
export function successResult<T>(data: T): ValidationResult<T>;
export function successResult<T>(data?: T): ValidationResult<T | void> {
  return {
    success: true,
    data: data as T,
  };
}

export function errorResult(error: ValidationError): ValidationResultError {
  return {
    success: false,
    error,
  };
}
