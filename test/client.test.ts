import { describe, it, expect, vi, beforeEach } from "vitest";

const requestMock = vi.fn();

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({ request: requestMock })),
    },
  };
});

const { MudbaseClient, MudbaseApiError, toMudbaseApiError, DEFAULT_BASE_URL } = await import("../src/client.js");

describe("MudbaseClient construction", () => {
  it("throws a clear error when no API key is provided", () => {
    expect(() => new MudbaseClient({ apiKey: "" })).toThrow(/API key is required/i);
  });

  it("defaults to the production Mudbase base URL", async () => {
    new MudbaseClient({ apiKey: "ak_test" });
    const axios = (await import("axios")).default;
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: DEFAULT_BASE_URL,
        headers: expect.objectContaining({ "X-API-Key": "ak_test" }),
      }),
    );
  });

  it("strips a trailing slash from a custom base URL", async () => {
    new MudbaseClient({ apiKey: "ak_test", baseUrl: "https://example.test/" });
    const axios = (await import("axios")).default;
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://example.test" }));
  });
});

describe("MudbaseClient document methods", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("lists documents with the real /api/data path and query params", async () => {
    requestMock.mockResolvedValue({ data: { data: [], pagination: {} } });
    const client = new MudbaseClient({ apiKey: "ak_test" });

    await client.listDocuments({ projectId: "p1", collectionId: "c1", page: 2, limit: 10, sort: "-createdAt" });

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/api/data/projects/p1/collections/c1/data",
        params: expect.objectContaining({ page: 2, limit: 10, sort: "-createdAt" }),
      }),
    );
  });

  it("creates a document with a POST and the request body as data", async () => {
    requestMock.mockResolvedValue({ data: { message: "Data created successfully", data: { _id: "d1" } } });
    const client = new MudbaseClient({ apiKey: "ak_test" });

    const result = await client.createDocument({ projectId: "p1", collectionId: "c1", data: { name: "Ada" } });

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/api/data/projects/p1/collections/c1/data",
        data: { name: "Ada" },
      }),
    );
    expect(result).toEqual({ message: "Data created successfully", data: { _id: "d1" } });
  });

  it("deletes a document with a DELETE against the documentId path", async () => {
    requestMock.mockResolvedValue({ data: { message: "Data deleted successfully" } });
    const client = new MudbaseClient({ apiKey: "ak_test" });

    await client.deleteDocument({ projectId: "p1", collectionId: "c1", documentId: "d1" });

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        url: "/api/data/projects/p1/collections/c1/data/d1",
      }),
    );
  });

  it("URL-encodes path segments so IDs cannot inject an extra path", async () => {
    requestMock.mockResolvedValue({ data: {} });
    const client = new MudbaseClient({ apiKey: "ak_test" });

    await client.getDocument({ projectId: "p1", collectionId: "c1", documentId: "../../secrets" });

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/data/projects/p1/collections/c1/data/..%2F..%2Fsecrets",
      }),
    );
  });
});

describe("MudbaseClient storage methods", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("uploads a file as multipart form data with the decoded buffer", async () => {
    requestMock.mockResolvedValue({ data: { success: true, files: [{ id: "f1" }] } });
    const client = new MudbaseClient({ apiKey: "ak_test" });

    const contentBase64 = Buffer.from("hello world").toString("base64");
    await client.uploadFile({
      projectId: "p1",
      bucketId: "b1",
      filename: "hello.txt",
      contentBase64,
      mimeType: "text/plain",
    });

    expect(requestMock).toHaveBeenCalledTimes(1);
    const call = requestMock.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.url).toBe("/api/bucket/projects/p1/buckets/b1/files");
    expect(call.headers).toBeDefined();
  });

  it("rejects an empty decoded file before making a request", async () => {
    const client = new MudbaseClient({ apiKey: "ak_test" });
    await expect(
      client.uploadFile({ projectId: "p1", bucketId: "b1", filename: "empty.txt", contentBase64: "" }),
    ).rejects.toThrow(MudbaseApiError);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("requests a signed download URL with the given expiry", async () => {
    requestMock.mockResolvedValue({ data: { success: true, signedUrl: "https://example.test/x" } });
    const client = new MudbaseClient({ apiKey: "ak_test" });

    await client.getFileDownloadUrl({ projectId: "p1", bucketId: "b1", fileId: "f1", expiresIn: 120 });

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/api/bucket/projects/p1/buckets/b1/files/f1/signed-url",
        data: { expiresIn: 120 },
      }),
    );
  });
});

describe("toMudbaseApiError", () => {
  it("passes an existing MudbaseApiError through unchanged", () => {
    const original = new MudbaseApiError("already normalized", { status: 404, code: "not_found" });
    expect(toMudbaseApiError(original)).toBe(original);
  });

  it("turns a 401 response into an unauthorized error mentioning the API key", () => {
    const axiosLikeError = {
      isAxiosError: true,
      message: "Request failed with status code 401",
      response: { status: 401, data: { error: "Invalid API key" } },
    };
    const normalized = toMudbaseApiError(axiosLikeError);
    expect(normalized).toBeInstanceOf(MudbaseApiError);
    expect(normalized.status).toBe(401);
    expect(normalized.message).toMatch(/Invalid API key/);
  });

  it("turns a network error (no response) into a clear connectivity message", () => {
    const axiosLikeError = {
      isAxiosError: true,
      message: "getaddrinfo ENOTFOUND cloud.mudbase.dev",
      response: undefined,
    };
    const normalized = toMudbaseApiError(axiosLikeError);
    expect(normalized.code).toBe("network_error");
    expect(normalized.message).toMatch(/Could not reach the Mudbase API/);
  });

  it("wraps a plain Error in a MudbaseApiError", () => {
    const normalized = toMudbaseApiError(new Error("boom"));
    expect(normalized).toBeInstanceOf(MudbaseApiError);
    expect(normalized.message).toBe("boom");
  });
});
