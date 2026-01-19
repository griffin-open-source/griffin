import { Frequency as FrequencyType, FrequencyUnit } from "./schema";

export class FrequencyBuilder {
  private value: number;

  constructor(value: number) {
    this.value = value;
  }

  minute(): FrequencyType {
    return { every: this.value, unit: FrequencyUnit.MINUTE };
  }

  minutes(): FrequencyType {
    return { every: this.value, unit: FrequencyUnit.MINUTE };
  }

  hour(): FrequencyType {
    return { every: this.value, unit: FrequencyUnit.HOUR };
  }

  hours(): FrequencyType {
    return { every: this.value, unit: FrequencyUnit.HOUR };
  }

  day(): FrequencyType {
    return { every: this.value, unit: FrequencyUnit.DAY };
  }

  days(): FrequencyType {
    return { every: this.value, unit: FrequencyUnit.DAY };
  }
}

// Export builder as Frequency for convenience
export const Frequency = {
  every: (value: number) => new FrequencyBuilder(value),
};
