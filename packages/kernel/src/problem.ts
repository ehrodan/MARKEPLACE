import { z } from "zod";

export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  code: z.string(),
  detail: z.string(),
  correlationId: z.string(),
  fieldErrors: z.array(fieldErrorSchema),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export class AppProblem extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly typePath: string;
  readonly fieldErrors: Array<{ field: string; message: string }>;

  constructor(input: {
    status: number;
    code: string;
    title: string;
    detail: string;
    typePath?: string;
    fieldErrors?: Array<{ field: string; message: string }>;
  }) {
    super(input.detail);
    this.name = "AppProblem";
    this.status = input.status;
    this.code = input.code;
    this.title = input.title;
    this.typePath = input.typePath ?? input.code.toLowerCase().replaceAll("_", "-");
    this.fieldErrors = input.fieldErrors ?? [];
  }

  toProblemDetails(correlationId: string, errorBaseUrl: string): ProblemDetails {
    return {
      type: new URL(this.typePath, `${errorBaseUrl.replace(/\/$/, "")}/`).toString(),
      title: this.title,
      status: this.status,
      code: this.code,
      detail: this.message,
      correlationId,
      fieldErrors: this.fieldErrors,
    };
  }
}

export function validationProblem(
  fieldErrors: Array<{ field: string; message: string }>,
): AppProblem {
  return new AppProblem({
    status: 422,
    code: "VALIDATION_ERROR",
    title: "Dados inválidos",
    detail: "Revise os campos informados.",
    fieldErrors,
  });
}
