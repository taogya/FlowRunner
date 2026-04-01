// Trace: DD-03-004002

/**
 * Resolve a dot-notation path on an object.
 * e.g. resolvePath({ stdout: "hello" }, "stdout") => "hello"
 */
function resolvePath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const key of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function stringify(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? null);
}

export function expandTemplate(
  template: string,
  input: unknown,
  variables?: { entries(): [string, unknown][] },
): string {
  // Replace {{input.xxx}} dot-notation first (more specific pattern)
  let result = template.replace(/\{\{input\.([a-zA-Z0-9_.]+)\}\}/g, (_match, path: string) => {
    const resolved = resolvePath(input, path);
    return stringify(resolved);
  });

  // Replace {{input}} with full input
  result = result.replace(/\{\{input\}\}/g, stringify(input));

  // Trace: REV-016 #7 — Replace {{vars.xxx}} with shared variable values
  if (variables) {
    const varMap = Object.fromEntries(variables.entries());
    result = result.replace(/\{\{vars\.([a-zA-Z0-9_.]+)\}\}/g, (_match, path: string) => {
      const resolved = resolvePath(varMap, path);
      return stringify(resolved);
    });
  }

  return result;
}
