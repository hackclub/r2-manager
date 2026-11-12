import { expect, test } from "bun:test";
import { hasBucketRole, isBucketRole } from "../lib/bucket-policy";
import { parseRules, ruleError } from "../lib/rule-policy";

test("bucket roles only inherit lower privileges", () => {
  for (const role of ["viewer", "editor", "manager"]) expect(hasBucketRole(role)).toBe(true);
  expect(hasBucketRole("viewer", "editor")).toBe(false);
  expect(hasBucketRole("editor", "manager")).toBe(false);
  expect(hasBucketRole("manager", "editor")).toBe(true);
  for (const value of [null, undefined, "owner", "toString", "__proto__"]) {
    expect(isBucketRole(value)).toBe(false);
    expect(hasBucketRole(value)).toBe(false);
  }
});
test("CORS validates required fields, methods, and preflight durations", () => {
  const rule = {
    allowed: { origins: ["https://example.com"], methods: ["PUT"], headers: ["content-type"] },
    maxAgeSeconds: 0,
  };
  expect(ruleError("cors", [rule])).toBeNull();
  expect(ruleError("cors", [{ ...rule, allowed: { ...rule.allowed, origins: [] } }])).toContain(
    "origin",
  );
  expect(
    ruleError("cors", [{ ...rule, allowed: { ...rule.allowed, methods: ["OPTIONS"] } }]),
  ).toContain("method");
  for (const maxAgeSeconds of [-1, 86401, 1.5, "300"])
    expect(ruleError("cors", [{ ...rule, maxAgeSeconds }])).toContain("duration");
  expect(ruleError("cors", [rule, rule])).toBeNull();
  expect(
    ruleError("cors", [
      { ...rule, id: "same" },
      { ...rule, id: "same" },
    ]),
  ).toContain("unique");
});
test("lifecycle rules retain exact ages, UTC dates, disabled rules, and unknown fields", () => {
  const rules = [
    {
      id: "archive",
      enabled: false,
      conditions: { prefix: "logs/", future: true },
      storageClassTransitions: [
        { storageClass: "InfrequentAccess", condition: { type: "Age", maxAge: 3601 } },
      ],
      deleteObjectsTransition: { condition: { type: "Date", date: "2027-02-01T15:30:00Z" } },
      future: { preserve: true },
    },
  ];
  expect(parseRules("lifecycle", JSON.stringify(rules))).toEqual(rules);
  const invalid = [
    { ...rules[0], enabled: "false" },
    { ...rules[0], conditions: {} },
    { ...rules[0], deleteObjectsTransition: { condition: { type: "Age", maxAge: -1 } } },
    { ...rules[0], deleteObjectsTransition: { condition: { type: "Date", date: "bad-date" } } },
    {
      ...rules[0],
      abortMultipartUploadsTransition: {
        condition: { type: "Date", date: "2027-02-01T00:00:00Z" },
      },
    },
    {
      ...rules[0],
      storageClassTransitions: [
        { storageClass: "Standard", condition: { type: "Age", maxAge: 0 } },
      ],
    },
    { id: "empty", enabled: true, conditions: { prefix: "" } },
  ];
  for (const rule of invalid) expect(ruleError("lifecycle", [rule])).not.toBeNull();
});
test("empty rules are valid and malformed JSON, shapes, and oversized policies fail", () => {
  for (const kind of ["cors", "lifecycle"]) {
    expect(parseRules(kind, "[]")).toEqual([]);
    expect(() => parseRules(kind, "{")).toThrow("valid JSON");
    for (const value of [null, {}, [null], Array(101).fill({})])
      expect(ruleError(kind, value)).not.toBeNull();
  }
});
