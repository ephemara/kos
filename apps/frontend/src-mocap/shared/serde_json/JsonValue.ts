/**
 * JSON value types compatible with serde_json from Rust
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

export function isJsonPrimitive(value: JsonValue): value is null | boolean | number | string {
  return value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string';
}
