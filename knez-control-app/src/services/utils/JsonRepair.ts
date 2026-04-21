// ─── JsonRepair.ts ─────────────────────────────────────────────────
// T3: JSON Repair and Recovery — fixes common JSON syntax errors,
//     implements streaming parser for partial/incomplete JSON,
//     adds schema validation with auto-correction.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts to repair common JSON syntax errors in malformed JSON strings.
 */
export function repairJson(jsonStr: string): string | null {
  let repaired = jsonStr.trim();

  // Remove markdown code blocks
  repaired = repaired.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();

  // Remove trailing commas before closing braces/brackets
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  // Fix unquoted keys (common in sloppy JSON)
  repaired = repaired.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

  // Fix single quotes to double quotes
  repaired = repaired.replace(/'/g, '"');

  // Fix missing quotes around string values
  repaired = repaired.replace(/:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*([,}\]])/g, ': "$1"$2');

  // Fix escaped quotes
  repaired = repaired.replace(/\\"/g, '"');

  // Try to parse the repaired JSON
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    // If still fails, try more aggressive repair
    return aggressiveRepair(repaired);
  }
}

/**
 * Aggressive JSON repair for severely malformed JSON.
 */
function aggressiveRepair(jsonStr: string): string | null {
  try {
    // Extract JSON-like structures from mixed text
    const jsonMatch = jsonStr.match(/\{[^{}]*\{[^{}]*\}[^{}]*\}|\{[^{}]*\}/g);
    if (jsonMatch) {
      for (const match of jsonMatch) {
        try {
          JSON.parse(match);
          return match;
        } catch {
          continue;
        }
      }
    }

    // Try to balance braces
    const balanced = balanceBraces(jsonStr);
    if (balanced) {
      try {
        JSON.parse(balanced);
        return balanced;
      } catch {
        // Continue to next attempt
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Attempts to balance unbalanced braces in a JSON string.
 */
function balanceBraces(jsonStr: string): string | null {
  let openBraces = 0;
  let inString = false;
  let escapeNext = false;
  let result = jsonStr;

  for (let i = 0; i < result.length; i++) {
    const char = result[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        openBraces++;
      } else if (char === '}') {
        openBraces--;
      }
    }
  }

  // Add missing closing braces
  while (openBraces > 0) {
    result += '}';
    openBraces--;
  }

  // Remove extra closing braces
  while (openBraces < 0) {
    result = result.slice(0, -1);
    openBraces++;
  }

  return openBraces === 0 ? result : null;
}

/**
 * Streaming JSON parser for handling partial/incomplete JSON.
 */
export class StreamingJsonParser {
  private buffer = '';
  private depth = 0;
  private inString = false;
  private escapeNext = false;

  feed(chunk: string): { complete: string | null; remaining: string } {
    this.buffer += chunk;
    const complete = this.extractComplete();
    return { complete, remaining: this.buffer };
  }

  reset(): void {
    this.buffer = '';
    this.depth = 0;
    this.inString = false;
    this.escapeNext = false;
  }

  private extractComplete(): string | null {
    let i = 0;
    const startIdx = this.buffer.indexOf('{');

    if (startIdx === -1) {
      return null;
    }

    for (i = startIdx; i < this.buffer.length; i++) {
      const char = this.buffer[i];

      if (this.escapeNext) {
        this.escapeNext = false;
        continue;
      }

      if (char === '\\') {
        this.escapeNext = true;
        continue;
      }

      if (char === '"') {
        this.inString = !this.inString;
        continue;
      }

      if (!this.inString) {
        if (char === '{') {
          this.depth++;
        } else if (char === '}') {
          this.depth--;
          if (this.depth === 0) {
            const complete = this.buffer.slice(startIdx, i + 1);
            this.buffer = this.buffer.slice(i + 1);
            this.reset();
            return complete;
          }
        }
      }
    }

    return null;
  }
}

/**
 * Validates JSON against a schema and attempts auto-correction.
 */
export function validateAndCorrectJson(
  json: any,
  schema: { required: string[]; optional?: string[] }
): { valid: boolean; corrected: any; errors: string[] } {
  const errors: string[] = [];
  const corrected = { ...json };

  // Check required fields
  for (const field of schema.required) {
    if (!(field in corrected) || corrected[field] === undefined || corrected[field] === null) {
      errors.push(`Missing required field: ${field}`);
      // Try to infer default value
      corrected[field] = inferDefaultValue(field);
    }
  }

  // Remove unexpected fields (optional)
  if (schema.optional) {
    const allowedFields = new Set([...schema.required, ...schema.optional]);
    for (const key in corrected) {
      if (!allowedFields.has(key)) {
        delete corrected[key];
      }
    }
  }

  // Try to parse the corrected JSON
  try {
    JSON.stringify(corrected);
    return { valid: errors.length === 0, corrected, errors };
  } catch {
    return { valid: false, corrected: json, errors: [...errors, 'Failed to stringify corrected JSON'] };
  }
}

/**
 * Infers a default value for a missing field based on field name.
 */
function inferDefaultValue(fieldName: string): any {
  const lowerName = fieldName.toLowerCase();

  if (lowerName.includes('name') || lowerName.includes('title') || lowerName.includes('text')) {
    return '';
  }

  if (lowerName.includes('count') || lowerName.includes('number') || lowerName.includes('index')) {
    return 0;
  }

  if (lowerName.includes('enabled') || lowerName.includes('active') || lowerName.includes('visible')) {
    return false;
  }

  if (lowerName.includes('list') || lowerName.includes('items') || lowerName.includes('array')) {
    return [];
  }

  if (lowerName.includes('data') || lowerName.includes('config') || lowerName.includes('settings')) {
    return {};
  }

  return null;
}

/**
 * Extracts JSON fragment from mixed text/JSON output.
 */
export function extractJsonFragment(text: string): string | null {
  // Try to find JSON object in the text
  const jsonMatch = text.match(/\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // Try to find JSON array
  const arrayMatch = text.match(/\[(?:[^\[\]]|(?:\[(?:[^\[\]]|(?:\[[^\[\]]*\]))*\]))*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  return null;
}
