import { AllowedInternalBusinessStatuses, IncomingBusinessStatus } from "./types";

/**
 * Extract UUID from a FHIR reference (e.g., "ServiceRequest/550e8400-e29b-41d4-a716-446655440000")
 */
export const extractIdFromReference = (reference: string): string | null => {
  const parts = reference.split("/");

  return parts.length === 2 ? parts[1] : null;
};

/**
 * Mapping of incoming business status values to allowed internal business statuses
 */
export const businessStatusMapping: Record<
  IncomingBusinessStatus,
  AllowedInternalBusinessStatuses
> = {
  [IncomingBusinessStatus.ORDER_ACCEPTED]: AllowedInternalBusinessStatuses.CONFIRMED,
  [IncomingBusinessStatus.DISPATCHED]: AllowedInternalBusinessStatuses.DISPATCHED,
  [IncomingBusinessStatus.RECEIVED_AT_LAB]: AllowedInternalBusinessStatuses.RECEIVED,
};
