import z from "zod";

import {
  FHIRCodeableConceptSchema,
  FHIRIdentifierSchema,
  FHIRReferenceSchema,
  FHIRTaskSchema,
} from "../../lib/models/fhir/fhir-schemas";
import { IncomingBusinessStatus } from "./types";

export const orderStatusFHIRTaskSchema = FHIRTaskSchema.extend({
  identifier: z.array(FHIRIdentifierSchema).min(1).max(1),
  for: FHIRReferenceSchema,
  lastModified: z.iso.datetime(),
  businessStatus: FHIRCodeableConceptSchema.extend({
    text: z.enum(IncomingBusinessStatus),
  }),
});

export type OrderStatusFHIRTask = z.infer<typeof orderStatusFHIRTaskSchema>;
