import { describe, expect, it } from "vitest";
import { listGatewayMethods } from "./server-methods-list.js";

describe("gateway cognitive-only mode", () => {
  it("does not advertise legacy task_plan methods", () => {
    const methods = listGatewayMethods();
    expect(methods.some((method) => method.startsWith("task_plan."))).toBe(false);
    expect(methods).toContain("cognitive.task.submit");
    expect(methods).toContain("cognitive.runtime.force_start");
    expect(methods).toContain("cognitive.runtime.status");
  });
});
