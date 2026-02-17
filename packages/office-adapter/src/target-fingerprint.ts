import type { TargetFingerprint } from "@magistrat/shared-types";

export function stableTargetFingerprint(
  slideId: string,
  objectId: string,
  currentState: Record<string, unknown>
): TargetFingerprint {
  const preconditionHash = hash(JSON.stringify(currentState, sortObjectKeys));
  return {
    slideId,
    objectId,
    preconditionHash
  };
}

function hash(input: string): string {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value << 5) - value + input.charCodeAt(index);
    value |= 0;
  }
  return `h${Math.abs(value).toString(16)}`;
}

function sortObjectKeys(_key: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, unknown>>((acc, [key, nestedValue]) => {
      acc[key] = nestedValue;
      return acc;
    }, {});
}
