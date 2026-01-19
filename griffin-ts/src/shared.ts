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

export class TUnionOneOf<Types extends TSchema[] = TSchema[]> extends Type.Base<
  TSchema[]
> {
  public oneOf: Types;
  constructor(oneOf: Types) {
    super();
    this.oneOf = oneOf;
  }
}
export function UnionOneOf(oneOf: TSchema[]): TUnionOneOf {
  return new TUnionOneOf(oneOf);
}

//export interface TUnionOneOf<Types extends TSchema[] = TSchema[]> extends TSchema {
//  '~kind': 'UnionOneOf'
//  //static: { [K in keyof Types]: Static<Types[K]> }[number]
//  oneOf: Types
//}
//
//export function UnionOneOf<Types extends TSchema[]>(oneOf: [...Types], options: TSchemaOptions = {}) {
//  return { ...options, ["~kind"]: 'UnionOneOf', oneOf } as TUnionOneOf<Types>
//
//  ///return Memory.Create({ '~kind': 'UnionOneOf' }, { oneOf }, options) as never
//}
