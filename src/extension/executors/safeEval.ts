// Trace: DD-03-007001, DD-03-008003 — Safe expression evaluator (replaces new Function())
import jexl from "jexl";

// Singleton Jexl instance with preconfigured transforms
const jexlInstance = new jexl.Jexl();

// Add === operator (jexl only has ==)
jexlInstance.addBinaryOp("===", 30, (left: unknown, right: unknown) => left === right);
jexlInstance.addBinaryOp("!==", 30, (left: unknown, right: unknown) => left !== right);

// Add commonly useful transforms
jexlInstance.addTransform("length", (val: unknown) => {
  if (typeof val === "string" || Array.isArray(val)) {
    return val.length;
  }
  return 0;
});
jexlInstance.addTransform("upper", (val: unknown) => String(val).toUpperCase());
jexlInstance.addTransform("lower", (val: unknown) => String(val).toLowerCase());
jexlInstance.addTransform("trim", (val: unknown) => String(val).trim());
jexlInstance.addTransform("string", (val: unknown) => String(val));
jexlInstance.addTransform("number", (val: unknown) => Number(val));
jexlInstance.addTransform("keys", (val: unknown) =>
  val !== null && typeof val === "object" ? Object.keys(val as Record<string, unknown>) : [],
);
jexlInstance.addTransform("values", (val: unknown) =>
  val !== null && typeof val === "object" ? Object.values(val as Record<string, unknown>) : [],
);

// Trace: FEAT-00002 — import IVariableStore for shared variable access in expressions
import type { IVariableStore } from "@extension/interfaces/IVariableStore.js";

/**
 * Build the jexl evaluation context.
 * - `input`: the node's input data
 * - `vars`: shared variable store entries (if provided)
 * - `extraContext`: additional top-level variables (e.g. `index` for loops)
 */
function buildContext(
  input: unknown,
  variables?: IVariableStore,
  extraContext?: Record<string, unknown>,
): Record<string, unknown> {
  const ctx: Record<string, unknown> = { input };
  if (variables) {
    ctx.vars = Object.fromEntries(variables.entries());
  }
  if (extraContext) {
    Object.assign(ctx, extraContext);
  }
  return ctx;
}

/**
 * Evaluate an expression safely using Jexl.
 *
 * The expression has access to:
 * - `input` — the node's input data
 * - `vars` — shared variable store (if provided)
 *
 * Jexl supports: property access (input.foo), comparisons (>, <, ==, ===),
 * arithmetic (+, -, *, /), ternary (a ? b : c), array indexing (input[0]),
 * and pipe transforms (input|length, input|upper).
 *
 * @param expression The expression string to evaluate
 * @param input The input value accessible as `input` in the expression
 * @param variables Optional shared variable store accessible as `vars` in the expression
 * @param extraContext Optional additional top-level variables (e.g. `{ index: 0 }` for loops)
 * @returns The evaluation result
 * @throws Error if the expression is invalid or evaluation fails
 */
export async function safeEval(
  expression: string,
  input: unknown,
  variables?: IVariableStore,
  extraContext?: Record<string, unknown>,
): Promise<unknown> {
  return jexlInstance.eval(expression, buildContext(input, variables, extraContext));
}

/**
 * Evaluate an expression synchronously using Jexl.
 *
 * @param expression The expression string to evaluate
 * @param input The input value accessible as `input` in the expression
 * @param variables Optional shared variable store accessible as `vars` in the expression
 * @param extraContext Optional additional top-level variables
 * @returns The evaluation result
 * @throws Error if the expression is invalid or evaluation fails
 */
export function safeEvalSync(
  expression: string,
  input: unknown,
  variables?: IVariableStore,
  extraContext?: Record<string, unknown>,
): unknown {
  return jexlInstance.evalSync(expression, buildContext(input, variables, extraContext));
}
