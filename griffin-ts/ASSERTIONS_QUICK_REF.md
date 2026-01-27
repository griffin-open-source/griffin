# Assertion DSL Quick Reference

## Basic Structure

```typescript
.assert((state) => [
  Assert(state["node_name"].accessor["path"]).predicate(),
])
```

## Accessors (Subjects)

| Accessor   | Description          | Example                                 |
| ---------- | -------------------- | --------------------------------------- |
| `.body`    | Response body        | `state["node"].body["data"]["id"]`      |
| `.headers` | Response headers     | `state["node"].headers["content-type"]` |
| `.status`  | HTTP status code     | `state["node"].status`                  |
| `.latency` | Request latency (ms) | `state["node"].latency`                 |

**Note:** For body assertions, the response type is automatically detected and defaults to JSON. Path traversal uses JSONPath for JSON responses.

## Array Access

```typescript
state["node"].body["items"].at(0)["name"]; // First item
state["node"].body["matrix"].at(2).at(3); // 2D array
```

## Unary Predicates

| Predicate      | Description                  | Negation                         |
| -------------- | ---------------------------- | -------------------------------- |
| `.isNull()`    | Value is null                | `.not.isNull()` / `.isDefined()` |
| `.isDefined()` | Value is not null            | `.not.isDefined()` / `.isNull()` |
| `.isTrue()`    | Value is true                | `.not.isTrue()`                  |
| `.isFalse()`   | Value is false               | `.not.isFalse()`                 |
| `.isEmpty()`   | String/array/object is empty | `.not.isEmpty()`                 |

## Binary Predicates - Equality

| Predicate        | Description           | Example                               |
| ---------------- | --------------------- | ------------------------------------- |
| `.equals(x)`     | Value equals x        | `Assert(status).equals(200)`          |
| `.not.equals(x)` | Value doesn't equal x | `Assert(error).not.equals("timeout")` |

## Binary Predicates - Comparison

| Predicate                | Description | Example                              |
| ------------------------ | ----------- | ------------------------------------ |
| `.greaterThan(x)`        | Value > x   | `Assert(count).greaterThan(0)`       |
| `.greaterThanOrEqual(x)` | Value >= x  | `Assert(age).greaterThanOrEqual(18)` |
| `.lessThan(x)`           | Value < x   | `Assert(time_ms).lessThan(500)`      |
| `.lessThanOrEqual(x)`    | Value <= x  | `Assert(score).lessThanOrEqual(100)` |

Negations reverse the operator:

- `.not.greaterThan(100)` → value <= 100
- `.not.lessThan(0)` → value >= 0

## Binary Predicates - Strings

| Predicate            | Description                 | Example                                  |
| -------------------- | --------------------------- | ---------------------------------------- |
| `.contains(x)`       | String contains x           | `Assert(type).contains("json")`          |
| `.not.contains(x)`   | String doesn't contain x    | `Assert(url).not.contains("staging")`    |
| `.startsWith(x)`     | String starts with x        | `Assert(path).startsWith("/api/")`       |
| `.not.startsWith(x)` | String doesn't start with x | `Assert(version).not.startsWith("v1.")`  |
| `.endsWith(x)`       | String ends with x          | `Assert(email).endsWith("@example.com")` |
| `.not.endsWith(x)`   | String doesn't end with x   | `Assert(file).not.endsWith(".tmp")`      |

## Common Patterns

### Status Checks

```typescript
Assert(state["node"].status).equals(200);
Assert(state["node"].status).lessThan(400); // Any success
Assert(state["node"].status).not.equals(500); // Not server error
```

### Latency Checks

```typescript
Assert(state["node"].latency).lessThan(500); // Response time under 500ms
Assert(state["node"].latency).lessThanOrEqual(1000); // Max 1 second
Assert(state["node"].latency).greaterThan(0); // Sanity check
```

### Existence Checks

```typescript
Assert(state["node"].body["id"]).not.isNull();
Assert(state["node"].body["data"]).isDefined();
Assert(state["node"].body["items"]).not.isEmpty();
```

### Value Validation

```typescript
Assert(state["node"].body["email"]).equals("test@example.com");
Assert(state["node"].body["age"]).greaterThanOrEqual(18);
Assert(state["node"].body["score"]).lessThan(100);
```

### String Matching

```typescript
Assert(state["node"].headers["content-type"]).contains("application/json");
Assert(state["node"].body["version"]).startsWith("v2.");
Assert(state["node"].body["email"]).endsWith("@example.com");
```

### Boolean Checks

```typescript
Assert(state["node"].body["active"]).isTrue();
Assert(state["node"].body["deleted"]).isFalse();
Assert(state["node"].body["verified"]).not.isFalse();
```

### Array Elements

```typescript
Assert(state["node"].body["items"].at(0)["name"]).equals("First");
Assert(state["node"].body["users"].at(2)["active"]).isTrue();
```

## Multi-Node Example

```typescript
createTestBuilder({ name: "user-flow" })
  .request("create", { method: POST /* ... */ })
  .request("verify", { method: GET /* ... */ })
  .assert((state) => [
    // Check create response
    Assert(state["create"].status).equals(201),
    Assert(state["create"].body["id"]).not.isNull(),

    // Check verify response
    Assert(state["verify"].status).equals(200),
    Assert(state["verify"].body["email"]).equals("test@example.com"),
  ]);
```

## Type Safety

TypeScript provides autocomplete and errors:

```typescript
.request("user_create", { /* ... */ })
.assert((state) => [
  state["user_create"]  // ✓ Autocomplete shows this node
  state["typo"]         // ❌ TypeScript error

  state["user_create"].body     // ✓ Valid accessor
  state["user_create"].invalid  // ❌ TypeScript error
])
```

## Cheat Sheet

| Task              | Code                                                     |
| ----------------- | -------------------------------------------------------- |
| Status is 200     | `Assert(state["n"].status).equals(200)`                  |
| Latency < 500ms   | `Assert(state["n"].latency).lessThan(500)`               |
| Body field exists | `Assert(state["n"].body["x"]).not.isNull()`              |
| String contains   | `Assert(state["n"].body["msg"]).contains("ok")`          |
| Number in range   | `Assert(state["n"].body["age"]).greaterThanOrEqual(18)`  |
| Boolean true      | `Assert(state["n"].body["active"]).isTrue()`             |
| Header has value  | `Assert(state["n"].headers["x-id"]).not.isEmpty()`       |
| Array not empty   | `Assert(state["n"].body["items"]).not.isEmpty()`         |
| First array item  | `Assert(state["n"].body["items"].at(0)["name"])...`      |
| Nested object     | `Assert(state["n"].body["user"]["profile"]["email"])...` |
