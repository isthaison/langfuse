import {
  convertLegacyParamsToFilterState,
  mergeFilters,
  type LegacyTraceParams,
} from "@langfuse/shared/src/server";
import type { FilterState } from "@langfuse/shared";

describe("Filter Conversion Utilities", () => {
  describe("convertLegacyParamsToFilterState", () => {
    it("should convert empty params to empty FilterState", () => {
      const params: LegacyTraceParams = {};
      const result = convertLegacyParamsToFilterState(params);
      expect(result).toEqual([]);
    });

    it("should convert userId to string filter", () => {
      const params: LegacyTraceParams = { userId: "test-user" };
      const result = convertLegacyParamsToFilterState(params);
      expect(result).toEqual([
        {
          type: "string",
          column: "userId",
          operator: "=",
          value: "test-user",
        },
      ]);
    });

    it("should convert name to string filter", () => {
      const params: LegacyTraceParams = { name: "test-trace" };
      const result = convertLegacyParamsToFilterState(params);
      expect(result).toEqual([
        {
          type: "string",
          column: "name",
          operator: "=",
          value: "test-trace",
        },
      ]);
    });

    it("should convert single tag to array options filter", () => {
      const params: LegacyTraceParams = { tags: "production" };
      const result = convertLegacyParamsToFilterState(params);
      expect(result).toEqual([
        {
          type: "arrayOptions",
          column: "tags",
          operator: "any of",
          value: ["production"],
        },
      ]);
    });

    it("should convert multiple tags to array options filter", () => {
      const params: LegacyTraceParams = { tags: ["production", "important"] };
      const result = convertLegacyParamsToFilterState(params);
      expect(result).toEqual([
        {
          type: "arrayOptions",
          column: "tags",
          operator: "any of",
          value: ["production", "important"],
        },
      ]);
    });

    it("should convert single environment to string options filter", () => {
      const params: LegacyTraceParams = { environment: "production" };
      const result = convertLegacyParamsToFilterState(params);
      expect(result).toEqual([
        {
          type: "stringOptions",
          column: "environment",
          operator: "any of",
          value: ["production"],
        },
      ]);
    });

    it("should convert multiple environments to string options filter", () => {
      const params: LegacyTraceParams = {
        environment: ["production", "staging"],
      };
      const result = convertLegacyParamsToFilterState(params);
      expect(result).toEqual([
        {
          type: "stringOptions",
          column: "environment",
          operator: "any of",
          value: ["production", "staging"],
        },
      ]);
    });

    it("should convert timestamps to datetime filters", () => {
      const fromTime = "2024-01-01T00:00:00Z";
      const toTime = "2024-01-02T00:00:00Z";
      const params: LegacyTraceParams = {
        fromTimestamp: fromTime,
        toTimestamp: toTime,
      };
      const result = convertLegacyParamsToFilterState(params);
      expect(result).toEqual([
        {
          type: "datetime",
          column: "timestamp",
          operator: ">=",
          value: new Date(fromTime),
        },
        {
          type: "datetime",
          column: "timestamp",
          operator: "<",
          value: new Date(toTime),
        },
      ]);
    });

    it("should convert all parameters together", () => {
      const params: LegacyTraceParams = {
        userId: "test-user",
        name: "test-trace",
        tags: ["prod", "important"],
        environment: "production",
        sessionId: "session-123",
        version: "1.0",
        release: "v1.0.0",
        fromTimestamp: "2024-01-01T00:00:00Z",
        toTimestamp: "2024-01-02T00:00:00Z",
      };
      const result = convertLegacyParamsToFilterState(params);

      expect(result).toHaveLength(9);
      expect(result).toContainEqual({
        type: "string",
        column: "userId",
        operator: "=",
        value: "test-user",
      });
      expect(result).toContainEqual({
        type: "arrayOptions",
        column: "tags",
        operator: "any of",
        value: ["prod", "important"],
      });
      expect(result).toContainEqual({
        type: "stringOptions",
        column: "environment",
        operator: "any of",
        value: ["production"],
      });
    });
  });

  describe("mergeFilters", () => {
    it("should return legacy filters when no advanced filter provided", () => {
      const legacyParams: LegacyTraceParams = { userId: "test-user" };
      const result = mergeFilters(legacyParams);

      expect(result).toEqual([
        {
          type: "string",
          column: "userId",
          operator: "=",
          value: "test-user",
        },
      ]);
    });

    it("should return legacy filters when empty advanced filter provided", () => {
      const legacyParams: LegacyTraceParams = { userId: "test-user" };
      const result = mergeFilters(legacyParams, []);

      expect(result).toEqual([
        {
          type: "string",
          column: "userId",
          operator: "=",
          value: "test-user",
        },
      ]);
    });

    it("should prioritize advanced filter over legacy params", () => {
      const legacyParams: LegacyTraceParams = { userId: "legacy-user" };
      const advancedFilter: FilterState = [
        {
          type: "string",
          column: "userId",
          operator: "=",
          value: "advanced-user",
        },
      ];

      const result = mergeFilters(legacyParams, advancedFilter);

      expect(result).toEqual([
        {
          type: "string",
          column: "userId",
          operator: "=",
          value: "advanced-user",
        },
      ]);
    });

    it("should merge non-conflicting filters", () => {
      const legacyParams: LegacyTraceParams = {
        userId: "legacy-user",
        tags: ["prod"],
      };
      const advancedFilter: FilterState = [
        {
          type: "stringObject",
          column: "metadata",
          key: "environment",
          operator: "=",
          value: "production",
        },
      ];

      const result = mergeFilters(legacyParams, advancedFilter);

      expect(result).toHaveLength(3); // advanced filter + 2 legacy filters
      expect(result).toContainEqual({
        type: "stringObject",
        column: "metadata",
        key: "environment",
        operator: "=",
        value: "production",
      });
      expect(result).toContainEqual({
        type: "string",
        column: "userId",
        operator: "=",
        value: "legacy-user",
      });
      expect(result).toContainEqual({
        type: "arrayOptions",
        column: "tags",
        operator: "any of",
        value: ["prod"],
      });
    });

    it("should handle complex merge scenarios", () => {
      const legacyParams: LegacyTraceParams = {
        userId: "legacy-user", // This should be overridden
        name: "legacy-name", // This should be kept
        tags: ["legacy-tag"], // This should be overridden
      };
      const advancedFilter: FilterState = [
        {
          type: "string",
          column: "userId",
          operator: "contains",
          value: "advanced-user",
        },
        {
          type: "arrayOptions",
          column: "tags",
          operator: "any of",
          value: ["advanced-tag", "important"],
        },
      ];

      const result = mergeFilters(legacyParams, advancedFilter);

      expect(result).toHaveLength(3); // 2 advanced + 1 non-conflicting legacy
      expect(result).toContainEqual({
        type: "string",
        column: "userId",
        operator: "contains",
        value: "advanced-user",
      });
      expect(result).toContainEqual({
        type: "arrayOptions",
        column: "tags",
        operator: "any of",
        value: ["advanced-tag", "important"],
      });
      expect(result).toContainEqual({
        type: "string",
        column: "name",
        operator: "=",
        value: "legacy-name",
      });
    });
  });
});
