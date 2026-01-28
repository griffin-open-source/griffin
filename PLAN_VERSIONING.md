# Test Plan Versioning Guide

This document outlines the process for making breaking changes to the test plan schema while maintaining backward compatibility across all Griffin components.

## Overview

Griffin uses a **migrate-on-read** versioning strategy:
- Plans are stored in their original version in the database
- Plans are migrated to the latest version when loaded (if needed)
- All components can handle multiple plan versions simultaneously
- Migration functions transform plans between versions

## Architecture

The versioning system spans 5 packages:

1. **griffin-ts** - Single source of truth for schemas and migrations
2. **griffin-cli** - Validates and migrates DSL plans before sending to hub
3. **griffin-hub** - Stores plans in original version, migrates on read
4. **griffin-hub-sdk** - Auto-generated types from OpenAPI spec
5. **griffin-executor** - Migrates plans to latest before execution

## Process: Making a Breaking Change

When you need to introduce a breaking schema change (e.g., adding a required field, removing a field, changing field types), follow these steps:

### Step 1: Define the New Schema Version

**File:** `griffin-ts/src/schema.ts`

1. Create a new version-specific DSL schema:
   ```typescript
   export const PlanDSLSchemaV2 = Type.Object({
     locations: Type.Optional(Type.Array(Type.String())),
     name: Type.String(),
     version: Type.Literal("2.0"),  // New version
     frequency: FrequencySchema,
     nodes: Type.Array(NodeDSLSchema),
     edges: Type.Array(EdgeSchema),
     // Add new required fields here
     newRequiredField: Type.String(),
   });
   ```

2. Create a new version-specific resolved plan schema:
   ```typescript
   export const ResolvedPlanV2Schema = Type.Object({
     project: Type.String(),
     locations: Type.Optional(Type.Array(Type.String())),
     id: Type.Readonly(Type.String()),
     name: Type.String(),
     version: Type.Literal("2.0"),
     frequency: FrequencySchema,
     environment: Type.String({ default: "default" }),
     nodes: Type.Array(NodeResolvedSchema),
     edges: Type.Array(EdgeSchema),
     newRequiredField: Type.String(),
   });
   ```

3. Update the union schemas:
   ```typescript
   // Union of all supported DSL versions
   export const PlanDSLSchema = Type.Union([PlanDSLSchemaV1, PlanDSLSchemaV2]);
   
   // Union of all supported resolved versions
   export const ResolvedPlanSchema = Type.Union([ResolvedPlanV1Schema, ResolvedPlanV2Schema]);
   ```

4. Update type exports:
   ```typescript
   export type PlanDSLV2 = Static<typeof PlanDSLSchemaV2>;
   export type PlanDSL = PlanDSLV1 | PlanDSLV2;
   
   export type ResolvedPlanV2 = Static<typeof ResolvedPlanV2Schema>;
   export type ResolvedPlan = ResolvedPlanV1 | ResolvedPlanV2;
   ```

### Step 2: Write Migration Function

**File:** `griffin-ts/src/migrations.ts`

1. Create the migration function:
   ```typescript
   function migrateV1ToV2(plan: ResolvedPlanV1): ResolvedPlanV2 {
     return {
       ...plan,
       version: "2.0",
       // Set default values for new required fields
       newRequiredField: "default-value",
       // Transform existing fields if needed
       // existingField: transformField(plan.existingField),
     };
   }
   ```

2. Register the migration:
   ```typescript
   const migrations: Record<string, MigrationFn<any, any>> = {
     "1.0->2.0": migrateV1ToV2,
     // Future: "2.0->3.0": migrateV2ToV3,
   };
   ```

3. Update the `VersionedPlan` type in `griffin-hub/src/storage/plan-mapper.ts`:
   ```typescript
   export type VersionedPlan = PlanV1 | PlanV2;
   ```

4. Add the new case to the mapper switch:
   ```typescript
   switch (version) {
     case "1.0":
       return { ...publicFields, version: "1.0", ... } as PlanV1;
     case "2.0":
       return { ...publicFields, version: "2.0", ... } as PlanV2;
     default:
       throw new UnsupportedPlanVersionError(version);
   }
   ```

### Step 3: Update Version Constants

**File:** `griffin-ts/src/schema.ts`

```typescript
export const CURRENT_PLAN_VERSION = "2.0";  // Update to new version
export const SUPPORTED_PLAN_VERSIONS = ["1.0", "2.0"] as const;  // Add new version
```

### Step 4: Update Hub Schemas

**File:** `griffin-hub/src/schemas/plans.ts`

1. Import the new resolved plan schema from griffin-ts
2. Update `PlanV1Schema` to accept union of versions:
   ```typescript
   const PlanVersionSchema = Type.Union([
     Type.Literal("1.0"),
     Type.Literal("2.0"),  // Add new version
   ]);
   ```

### Step 5: Regenerate OpenAPI Spec and SDK

**Commands:**

```bash
# In griffin-hub: regenerate OpenAPI spec from TypeBox schemas
cd griffin-hub
npm run generate:openapi

# In griffin-hub-sdk: regenerate TypeScript types from OpenAPI spec
cd griffin-hub-sdk
npm run build
```

### Step 6: Update Builders (if DSL changed)

**Files:** `griffin-ts/src/builder.ts`, `griffin-ts/src/sequential-builder.ts`

If the DSL schema changed, update the builders to set the new version:
```typescript
build(): PlanDSL {
  return {
    ...this.plan,
    version: CURRENT_PLAN_VERSION,  // Will now be "2.0"
  };
}
```

### Step 7: Add Tests

**File:** `griffin-ts/src/migrations.test.ts`

Add tests for the new migration:
```typescript
describe("migrations", () => {
  it("migrates v1 plan to v2", () => {
    const v1Plan: ResolvedPlanV1 = {
      project: "test",
      id: "test-id",
      name: "test-plan",
      version: "1.0",
      frequency: { every: 1, unit: "MINUTE" },
      environment: "default",
      nodes: [],
      edges: [],
    };
    
    const v2Plan = migratePlan<ResolvedPlanV2>(v1Plan, "2.0");
    expect(v2Plan.version).toBe("2.0");
    expect(v2Plan.newRequiredField).toBe("default-value");
    // Assert other transformations
  });
});
```

### Step 8: Deploy in Order

**Critical:** Deploy packages in this specific order to maintain backward compatibility:

```mermaid
flowchart LR
    TS["1. griffin-ts<br/>new schemas"] --> SDK["2. griffin-hub-sdk<br/>regenerate"]
    SDK --> Executor["3. griffin-executor<br/>can read new"]
    Executor --> Hub["4. griffin-hub<br/>can store new"]
    Hub --> CLI["5. griffin-cli<br/>can write new"]
```

**Why this order matters:**
- **griffin-ts** must be deployed first so other packages can import new types
- **griffin-hub-sdk** must be regenerated before executor/hub use new types
- **griffin-executor** must handle new format before hub starts storing it
- **griffin-hub** must accept new format before CLI starts sending it
- **griffin-cli** can be deployed last since it only writes new format

## Example: Adding a Required Field

Let's say you want to add a required `timeout` field to plans:

### 1. Update Schema (`griffin-ts/src/schema.ts`)

```typescript
export const PlanDSLSchemaV2 = Type.Object({
  // ... existing fields ...
  version: Type.Literal("2.0"),
  timeout: Type.Number(),  // New required field
});
```

### 2. Write Migration (`griffin-ts/src/migrations.ts`)

```typescript
function migrateV1ToV2(plan: ResolvedPlanV1): ResolvedPlanV2 {
  return {
    ...plan,
    version: "2.0",
    timeout: 30000,  // Default timeout: 30 seconds
  };
}
```

### 3. Update Builders (`griffin-ts/src/builder.ts`)

```typescript
export class TestBuilder {
  private plan: Partial<PlanDSL> = {
    timeout: 30000,  // Set default in builder
  };
  
  // ... rest of builder ...
}
```

## Testing Strategy

### Unit Tests
- Test migration function transforms correctly
- Test union schema validates both old and new formats
- Test executor handles both versions

### Integration Tests
- Create v1 plan, store in hub, verify executor runs it
- Create v2 plan, store in hub, verify executor runs it
- Test mixed-version scenarios during rolling deployment

## Rollback Strategy

If a new version has issues:

1. **Immediate:** Revert the deployment (packages can still read old versions)
2. **Data:** No migration needed - plans stored in original version
3. **Code:** Revert version constants and remove migration function
4. **Deploy:** Deploy in reverse order (CLI → Hub → Executor → SDK → TS)

## Key Files Reference

| Package | Key Files | Purpose |
|---------|-----------|---------|
| griffin-ts | `src/schema.ts` | Schema definitions |
| griffin-ts | `src/migrations.ts` | Migration functions |
| griffin-hub | `src/storage/plan-mapper.ts` | DB → API contract mapping |
| griffin-hub | `src/schemas/plans.ts` | API contract schemas |
| griffin-hub | `src/routes/plan/index.ts` | API endpoints |
| griffin-executor | `src/executor.ts` | Plan execution |
| griffin-cli | `src/resolve.ts` | Plan resolution |

## Common Patterns

### Adding Optional Field
- No migration needed (old plans work fine)
- Just add field to new schema version
- Builders can set default value

### Adding Required Field
- Migration must provide default value
- Update builders to require/set the field
- Consider making it optional in v2, required in v3 for smoother transition

### Removing Field
- Migration should drop the field
- Update all code that references the field
- Consider deprecation period first

### Changing Field Type
- Migration must transform old type to new type
- Handle edge cases and invalid data gracefully
- Consider validation in migration

## Questions?

If you're unsure about a breaking change:
1. Check if it can be made non-breaking (additive changes)
2. Consider a deprecation period
3. Test migration with real plan data
4. Review with team before deploying
