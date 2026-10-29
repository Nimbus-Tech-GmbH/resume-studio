{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["resume", "changes", "gaps"],
  "properties": {
    "resume": {
      "type": "object",
      "additionalProperties": true
    },
    "changes": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "group", "path", "op", "before", "after", "reason", "evidence"],
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "group": { "type": "string", "minLength": 1 },
          "path": { "type": "string", "pattern": "^/" },
          "op": { "enum": ["rewrite", "reorder", "delete", "narrow"] },
          "before": {},
          "after": {},
          "reason": { "type": "string", "minLength": 1 },
          "evidence": {
            "type": "array",
            "items": { "type": "string", "pattern": "^/" }
          }
        }
      }
    },
    "gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["kind", "requirement", "detail", "searched"],
        "properties": {
          "kind": { "enum": ["missing_requirement", "ignored_constraint"] },
          "requirement": { "type": "string", "minLength": 1 },
          "detail": { "type": "string" },
          "searched": {
            "type": "array",
            "items": { "type": "string", "pattern": "^/" }
          }
        }
      }
    }
  }
}
