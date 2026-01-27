import { describe, it, expect } from "vitest";
import { Frequency } from "./frequency.js";
import { FrequencyUnit } from "./schema.js";

describe("Frequency Builder", () => {
  describe("Minute Frequencies", () => {
    it("should create minute frequency with singular form", () => {
      const freq = Frequency.every(1).minute();

      expect(freq).toEqual({
        every: 1,
        unit: FrequencyUnit.MINUTE,
      });
    });

    it("should create minute frequency with plural form", () => {
      const freq = Frequency.every(5).minutes();

      expect(freq).toEqual({
        every: 5,
        unit: FrequencyUnit.MINUTE,
      });
    });

    it("should support different minute values", () => {
      expect(Frequency.every(1).minutes()).toEqual({
        every: 1,
        unit: FrequencyUnit.MINUTE,
      });
      expect(Frequency.every(15).minutes()).toEqual({
        every: 15,
        unit: FrequencyUnit.MINUTE,
      });
      expect(Frequency.every(30).minutes()).toEqual({
        every: 30,
        unit: FrequencyUnit.MINUTE,
      });
      expect(Frequency.every(45).minutes()).toEqual({
        every: 45,
        unit: FrequencyUnit.MINUTE,
      });
    });
  });

  describe("Hour Frequencies", () => {
    it("should create hour frequency with singular form", () => {
      const freq = Frequency.every(1).hour();

      expect(freq).toEqual({
        every: 1,
        unit: FrequencyUnit.HOUR,
      });
    });

    it("should create hour frequency with plural form", () => {
      const freq = Frequency.every(2).hours();

      expect(freq).toEqual({
        every: 2,
        unit: FrequencyUnit.HOUR,
      });
    });

    it("should support different hour values", () => {
      expect(Frequency.every(1).hours()).toEqual({
        every: 1,
        unit: FrequencyUnit.HOUR,
      });
      expect(Frequency.every(6).hours()).toEqual({
        every: 6,
        unit: FrequencyUnit.HOUR,
      });
      expect(Frequency.every(12).hours()).toEqual({
        every: 12,
        unit: FrequencyUnit.HOUR,
      });
      expect(Frequency.every(24).hours()).toEqual({
        every: 24,
        unit: FrequencyUnit.HOUR,
      });
    });
  });

  describe("Day Frequencies", () => {
    it("should create day frequency with singular form", () => {
      const freq = Frequency.every(1).day();

      expect(freq).toEqual({
        every: 1,
        unit: FrequencyUnit.DAY,
      });
    });

    it("should create day frequency with plural form", () => {
      const freq = Frequency.every(7).days();

      expect(freq).toEqual({
        every: 7,
        unit: FrequencyUnit.DAY,
      });
    });

    it("should support different day values", () => {
      expect(Frequency.every(1).days()).toEqual({
        every: 1,
        unit: FrequencyUnit.DAY,
      });
      expect(Frequency.every(3).days()).toEqual({
        every: 3,
        unit: FrequencyUnit.DAY,
      });
      expect(Frequency.every(7).days()).toEqual({
        every: 7,
        unit: FrequencyUnit.DAY,
      });
      expect(Frequency.every(30).days()).toEqual({
        every: 30,
        unit: FrequencyUnit.DAY,
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero values", () => {
      expect(Frequency.every(0).minutes()).toEqual({
        every: 0,
        unit: FrequencyUnit.MINUTE,
      });
      expect(Frequency.every(0).hours()).toEqual({
        every: 0,
        unit: FrequencyUnit.HOUR,
      });
      expect(Frequency.every(0).days()).toEqual({
        every: 0,
        unit: FrequencyUnit.DAY,
      });
    });

    it("should handle large values", () => {
      expect(Frequency.every(1000).minutes()).toEqual({
        every: 1000,
        unit: FrequencyUnit.MINUTE,
      });
      expect(Frequency.every(100).hours()).toEqual({
        every: 100,
        unit: FrequencyUnit.HOUR,
      });
      expect(Frequency.every(365).days()).toEqual({
        every: 365,
        unit: FrequencyUnit.DAY,
      });
    });

    it("should handle decimal values", () => {
      expect(Frequency.every(1.5).hours()).toEqual({
        every: 1.5,
        unit: FrequencyUnit.HOUR,
      });
      expect(Frequency.every(0.5).days()).toEqual({
        every: 0.5,
        unit: FrequencyUnit.DAY,
      });
    });
  });

  describe("Fluent API", () => {
    it("should support method chaining", () => {
      const freq = Frequency.every(10).minutes();
      expect(freq).toBeDefined();
      expect(freq.every).toBe(10);
      expect(freq.unit).toBe(FrequencyUnit.MINUTE);
    });

    it("should create new frequency objects", () => {
      const freq1 = Frequency.every(5).minutes();
      const freq2 = Frequency.every(10).minutes();

      expect(freq1).not.toBe(freq2);
      expect(freq1.every).toBe(5);
      expect(freq2.every).toBe(10);
    });
  });

  describe("Consistency", () => {
    it("should produce same result for singular and plural forms", () => {
      expect(Frequency.every(1).minute()).toEqual(Frequency.every(1).minutes());
      expect(Frequency.every(1).hour()).toEqual(Frequency.every(1).hours());
      expect(Frequency.every(1).day()).toEqual(Frequency.every(1).days());
    });
  });
});
