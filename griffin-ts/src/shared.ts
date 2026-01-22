import {
  TSchema,
  TSchemaOptions,
  TUnsafe,
  Static,
  Unsafe,
  Type,
} from "typebox";
import { Value } from "typebox/value";
import { Memory } from "typebox/system";

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
