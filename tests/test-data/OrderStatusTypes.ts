export interface OrderStatusTaskPayload {
  resourceType: "Task";
  status: string;
  intent: string;
  identifier: Array<{ value: string }>;
  for: { reference: string };
  businessStatus?: { text: string };
  lastModified?: string;
}

export class OrderStatusTestData {
  static readonly DEFAULT_ORIGINATOR = "automatic-test";
  static readonly DEFAULT_STATUS = "in-progress";
  static readonly DEFAULT_INTENT = "order";
  static readonly BUSINESS_STATUS_ORDER_ACCEPTED = "order-accepted";
  static readonly BUSINESS_STATUS_DISPATCHED = "dispatched";
  static readonly BUSINESS_STATUS_RECEIVED_AT_LAB = "received-at-lab";
  static readonly EXPECTED_STATUS_CODE_CONFIRMED = "CONFIRMED";
  static readonly EXPECTED_STATUS_CODE_DISPATCHED = "DISPATCHED";
  static readonly EXPECTED_STATUS_CODE_RECEIVED = "RECEIVED";
}
