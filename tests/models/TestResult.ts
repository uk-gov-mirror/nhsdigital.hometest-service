export type ResultStatus = "RESULT_AVAILABLE" | "RESULT_WITHHELD" | "RESULT_PROCESSED";

export interface TestResult {
  order_uid: string;
  status: ResultStatus;
  correlation_id: string;
  created_at: Date;
}
