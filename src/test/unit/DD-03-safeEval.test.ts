// DD-03 safeEval UT tests — Safe expression evaluator (jexl-based)
// Trace: DD-03-007001, DD-03-008003

import { describe, it, expect } from "vitest";
import { safeEval } from "@extension/executors/safeEval.js";
import { VariableStore } from "@extension/interfaces/IVariableStore.js";

// ============================
// Basic expression evaluation
// ============================
describe("safeEval — basic expressions", () => {
  // DDUT-03-007001-00020
  it("arithmetic_addition_returnsSum", async () => {
    const result = await safeEval("1 + 2", null);
    expect(result).toBe(3);
  });

  // DDUT-03-007001-00021
  it("arithmetic_multiplication_returnsProduct", async () => {
    const result = await safeEval("3 * 4", null);
    expect(result).toBe(12);
  });

  // DDUT-03-007001-00022
  it("comparison_greaterThan_returnsBoolean", async () => {
    const result = await safeEval("5 > 3", null);
    expect(result).toBe(true);
  });

  // DDUT-03-007001-00023
  it("comparison_equality_returnsBoolean", async () => {
    const result = await safeEval("10 == 10", null);
    expect(result).toBe(true);
  });

  // DDUT-03-007001-00024
  it("strictEquality_sameType_returnsTrue", async () => {
    const result = await safeEval("10 === 10", null);
    expect(result).toBe(true);
  });

  // DDUT-03-007001-00025
  it("strictInequality_differentValues_returnsTrue", async () => {
    const result = await safeEval("10 !== 20", null);
    expect(result).toBe(true);
  });

  // DDUT-03-007001-00026
  it("ternary_trueCondition_returnsFirst", async () => {
    const result = await safeEval("true ? 'yes' : 'no'", null);
    expect(result).toBe("yes");
  });

  // DDUT-03-007001-00027
  it("stringLiteral_returnsString", async () => {
    const result = await safeEval("'hello'", null);
    expect(result).toBe("hello");
  });
});

// ============================
// Input variable access
// ============================
describe("safeEval — input access", () => {
  // DDUT-03-007001-00028
  it("inputPrimitive_numberInput_returnsInput", async () => {
    const result = await safeEval("input", 42);
    expect(result).toBe(42);
  });

  // DDUT-03-007001-00029
  it("inputString_stringInput_returnsInput", async () => {
    const result = await safeEval("input", "hello");
    expect(result).toBe("hello");
  });

  // DDUT-03-007001-00030
  it("inputPropertyAccess_objectInput_returnsProperty", async () => {
    const result = await safeEval("input.name", { name: "Alice", age: 30 });
    expect(result).toBe("Alice");
  });

  // DDUT-03-007001-00031
  it("inputNestedPropertyAccess_nestedObject_returnsNestedValue", async () => {
    const result = await safeEval("input.user.name", { user: { name: "Bob" } });
    expect(result).toBe("Bob");
  });

  // DDUT-03-007001-00032
  it("inputArrayIndex_arrayInput_returnsElement", async () => {
    const result = await safeEval("input[1]", [10, 20, 30]);
    expect(result).toBe(20);
  });

  // DDUT-03-007001-00033
  it("inputComparison_objectProperty_evaluatesCorrectly", async () => {
    const result = await safeEval("input.status == 'active'", { status: "active" });
    expect(result).toBe(true);
  });

  // DDUT-03-007001-00034
  it("inputNull_nullInput_accessibleAsInput", async () => {
    const result = await safeEval("input == null", null);
    expect(result).toBe(true);
  });
});

// ============================
// Variable store (vars) access
// ============================
describe("safeEval — vars access", () => {
  // DDUT-03-007001-00035
  it("varsAccess_simpleVariable_returnsValue", async () => {
    const vars = new VariableStore();
    vars.set("count", 5);
    const result = await safeEval("vars.count", null, vars);
    expect(result).toBe(5);
  });

  // DDUT-03-007001-00036
  it("varsAccess_stringVariable_returnsString", async () => {
    const vars = new VariableStore();
    vars.set("greeting", "hello");
    const result = await safeEval("vars.greeting", null, vars);
    expect(result).toBe("hello");
  });

  // DDUT-03-007001-00037
  it("varsAndInput_combined_evaluatesCorrectly", async () => {
    const vars = new VariableStore();
    vars.set("threshold", 10);
    const result = await safeEval("input > vars.threshold", 15, vars);
    expect(result).toBe(true);
  });

  // DDUT-03-007001-00038
  it("varsUndefinedKey_missingVariable_returnsUndefined", async () => {
    const vars = new VariableStore();
    const result = await safeEval("vars.missing", null, vars);
    expect(result).toBeUndefined();
  });

  // DDUT-03-007001-00039
  it("noVars_omitted_varsUndefined", async () => {
    const result = await safeEval("vars", null);
    expect(result).toBeUndefined();
  });
});

// ============================
// Extra context
// ============================
describe("safeEval — extraContext", () => {
  // DDUT-03-007001-00040
  it("extraContext_indexVariable_accessibleInExpression", async () => {
    const result = await safeEval("index", null, undefined, { index: 3 });
    expect(result).toBe(3);
  });

  // DDUT-03-007001-00041
  it("extraContext_combinedWithInput_evaluatesCorrectly", async () => {
    const result = await safeEval("input + index", 10, undefined, { index: 5 });
    expect(result).toBe(15);
  });

  // DDUT-03-007001-00042
  it("extraContext_combinedWithVars_evaluatesCorrectly", async () => {
    const vars = new VariableStore();
    vars.set("base", 100);
    const result = await safeEval("vars.base + index", null, vars, { index: 7 });
    expect(result).toBe(107);
  });
});

// ============================
// Transforms (pipes)
// ============================
describe("safeEval — transforms", () => {
  // DDUT-03-007001-00043
  it("lengthTransform_string_returnsLength", async () => {
    const result = await safeEval("input|length", "hello");
    expect(result).toBe(5);
  });

  // DDUT-03-007001-00044
  it("lengthTransform_array_returnsLength", async () => {
    const result = await safeEval("input|length", [1, 2, 3]);
    expect(result).toBe(3);
  });

  // DDUT-03-007001-00045
  it("upperTransform_string_returnsUpperCase", async () => {
    const result = await safeEval("input|upper", "hello");
    expect(result).toBe("HELLO");
  });

  // DDUT-03-007001-00046
  it("lowerTransform_string_returnsLowerCase", async () => {
    const result = await safeEval("input|lower", "HELLO");
    expect(result).toBe("hello");
  });

  // DDUT-03-007001-00047
  it("trimTransform_paddedString_returnsTrimmed", async () => {
    const result = await safeEval("input|trim", "  hello  ");
    expect(result).toBe("hello");
  });

  // DDUT-03-007001-00048
  it("keysTransform_object_returnsKeys", async () => {
    const result = await safeEval("input|keys", { a: 1, b: 2 });
    expect(result).toEqual(["a", "b"]);
  });

  // DDUT-03-007001-00049
  it("valuesTransform_object_returnsValues", async () => {
    const result = await safeEval("input|values", { a: 1, b: 2 });
    expect(result).toEqual([1, 2]);
  });

  // DDUT-03-007001-00050
  it("numberTransform_stringNumber_returnsNumber", async () => {
    const result = await safeEval("input|number", "42");
    expect(result).toBe(42);
  });

  // DDUT-03-007001-00051
  it("stringTransform_number_returnsString", async () => {
    const result = await safeEval("input|string", 42);
    expect(result).toBe("42");
  });

  // DDUT-03-007001-00052
  it("lengthTransform_nonArrayNonString_returnsZero", async () => {
    const result = await safeEval("input|length", 42);
    expect(result).toBe(0);
  });

  // DDUT-03-007001-00053
  it("keysTransform_nonObject_returnsEmptyArray", async () => {
    const result = await safeEval("input|keys", null);
    expect(result).toEqual([]);
  });
});

// ============================
// Error handling
// ============================
describe("safeEval — error handling", () => {
  // DDUT-03-007001-00054
  it("invalidSyntax_throwsError", async () => {
    await expect(safeEval("1 +", null)).rejects.toThrow();
  });

  // DDUT-03-007001-00055
  it("undefinedPropertyAccess_returnsUndefined", async () => {
    const result = await safeEval("input.notExist", { name: "test" });
    expect(result).toBeUndefined();
  });

  // DDUT-03-007001-00056
  it("emptyExpression_throwsError", async () => {
    // Jexl throws on empty expression (null AST)
    await expect(safeEval("", null)).rejects.toThrow();
  });
});

// ============================
// Security — jexl sandbox safety
// ============================
describe("safeEval — security", () => {
  // DDUT-03-007001-00057
  it("noGlobalAccess_processNotAccessible", async () => {
    // Jexl sandboxes expressions — global objects should not be accessible
    const result = await safeEval("process", null);
    expect(result).toBeUndefined();
  });

  // DDUT-03-007001-00058
  it("noGlobalAccess_requireNotAccessible", async () => {
    const result = await safeEval("require", null);
    expect(result).toBeUndefined();
  });

  // DDUT-03-007001-00059
  it("noFunctionConstructor_cannotCreateFunction", async () => {
    // Jexl doesn't support Function constructor syntax
    await expect(safeEval("Function('return 1')()", null)).rejects.toThrow();
  });

  // DDUT-03-007001-00060
  it("noPrototypeAccess_constructorIsReservedKeyword", async () => {
    // Jexl treats 'constructor' as a reserved token — expression is rejected
    await expect(safeEval("input.constructor", { x: 1 })).rejects.toThrow();
  });
});
