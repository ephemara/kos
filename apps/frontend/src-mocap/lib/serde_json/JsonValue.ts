/**
 * JsonValue - Compatible with serde_json::Value
 * 
 * This type represents any valid JSON value.
 */

export type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | { [key: string]: JsonValue };
