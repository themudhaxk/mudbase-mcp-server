import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SERVER_VERSION, createServer } from "../src/server.js";

const readJson = (relativePath: string): { version: string; packages?: { version: string }[] } =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));

describe("SERVER_VERSION", () => {
  it("matches the version in package.json", () => {
    expect(SERVER_VERSION).toBe(readJson("../package.json").version);
  });

  it("matches the version and package version in server.json", () => {
    const serverJson = readJson("../server.json");
    expect(serverJson.version).toBe(SERVER_VERSION);
    expect(serverJson.packages?.[0]?.version).toBe(SERVER_VERSION);
  });

  it("is the 0.3.0 release", () => {
    expect(SERVER_VERSION).toBe("0.3.0");
  });
});

describe("createServer", () => {
  it("builds a server without sandbox tools unless asked", () => {
    expect(() => createServer({ apiKey: "ak_test" })).not.toThrow();
    expect(() => createServer({ apiKey: "ak_test", sandboxTools: true })).not.toThrow();
  });
});
