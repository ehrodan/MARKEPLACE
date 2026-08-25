import { z } from "zod";

export const apiProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string(),
  correlationId: z.string(),
  fieldErrors: z.array(z.object({ field: z.string(), message: z.string() })),
});
