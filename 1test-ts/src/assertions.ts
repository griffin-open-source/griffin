export class Assertions {
  isEqual(expected: any, actual: any): { type: string; expected: any; actual: any; message?: string } {
    return {
      type: 'isEqual',
      expected,
      actual,
      message: `Expected ${expected}, but got ${actual}`,
    };
  }

  notNull(value: any): { type: string; expected: any; actual: any; message?: string } {
    return {
      type: 'notNull',
      expected: null,
      actual: value,
      message: value === null ? 'Expected value to not be null' : undefined,
    };
  }

  isTrue(value: boolean): { type: string; expected: any; actual: any; message?: string } {
    return {
      type: 'isTrue',
      expected: true,
      actual: value,
      message: value !== true ? 'Expected value to be true' : undefined,
    };
  }

  isFalse(value: boolean): { type: string; expected: any; actual: any; message?: string } {
    return {
      type: 'isFalse',
      expected: false,
      actual: value,
      message: value !== false ? 'Expected value to be false' : undefined,
    };
  }
}

export const asserts = new Assertions();
