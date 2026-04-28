import { OrderStatus, ResultStatus } from "../../lib/types/status";
import { IncomingBusinessStatus, StatusKind } from "./types";

export type ResolvedStatus =
  | { kind: StatusKind.Order; status: OrderStatus }
  | { kind: StatusKind.Result; status: ResultStatus };

const statusResolutionMap: Record<IncomingBusinessStatus, ResolvedStatus> = {
  [IncomingBusinessStatus.ORDER_ACCEPTED]: {
    kind: StatusKind.Order,
    status: OrderStatus.Confirmed,
  },
  [IncomingBusinessStatus.DISPATCHED]: {
    kind: StatusKind.Order,
    status: OrderStatus.Dispatched,
  },
  [IncomingBusinessStatus.RECEIVED_AT_LAB]: {
    kind: StatusKind.Order,
    status: OrderStatus.Received,
  },
  [IncomingBusinessStatus.TEST_PROCESSED]: {
    kind: StatusKind.Result,
    status: ResultStatus.Result_Processed,
  },
};

export const resolveStatus = (incoming: IncomingBusinessStatus): ResolvedStatus =>
  statusResolutionMap[incoming];
