import type { Frequency as FrequencyType } from './types';

export class FrequencyBuilder {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  minute(): FrequencyType {
    return { every: this.value, unit: 'minute' };
  }

  minutes(): FrequencyType {
    return { every: this.value, unit: 'minute' };
  }

  hour(): FrequencyType {
    return { every: this.value, unit: 'hour' };
  }

  hours(): FrequencyType {
    return { every: this.value, unit: 'hour' };
  }

  day(): FrequencyType {
    return { every: this.value, unit: 'day' };
  }

  days(): FrequencyType {
    return { every: this.value, unit: 'day' };
  }
}

// Export builder as Frequency for convenience
export const Frequency = {
  every: (value: number) => new FrequencyBuilder(value),
};
