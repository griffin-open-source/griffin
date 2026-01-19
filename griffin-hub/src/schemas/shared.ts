import {
  Type,
  TSchema,
  Static,
  Unsafe,
  TUnsafe,
  TSchemaOptions,
} from "typebox";

export function Ref<T extends TSchema>(
  t: T,
  options: TSchemaOptions = {},
): TUnsafe<Static<T>> {
  const id = (t as unknown as Record<string, string | undefined>).$id;
  if (!id) {
    throw new Error("missing ID on schema");
  }
  return Unsafe<Static<T>>({ ...t, $ref: id, $id: undefined, ...options });
}

export const StringEnum = <T extends string[]>(
  values: [...T],
  options: TSchemaOptions = {},
) =>
  Type.Unsafe<T[number]>({
    type: "string",
    enum: values,
    ...options,
  });

export const PaginatedResponseSchema = <T extends TSchema>(schema: T) =>
  Type.Object({
    data: Type.Array(schema),
    total: Type.Number(),
    page: Type.Number(),
    limit: Type.Number(),
  });

export const PaginationRequestOpts = {
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Number({ minimum: 0 })),
};

export const SuccessResponseSchema = <T extends TSchema>(schema: T) =>
  Type.Object({
    data: schema,
  });
export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
});
export const ErrorResponseOpts = {
  400: ErrorResponseSchema,
  401: ErrorResponseSchema,
  403: ErrorResponseSchema,
  404: ErrorResponseSchema,
  500: ErrorResponseSchema,
  502: ErrorResponseSchema,
  503: ErrorResponseSchema,
  504: ErrorResponseSchema,
};
