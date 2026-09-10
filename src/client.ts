import axios, { type AxiosInstance, type AxiosRequestConfig, isAxiosError } from "axios";
import FormData from "form-data";

/** Default Mudbase API base URL. Override with MUDBASE_BASE_URL for self-hosted or staging use. */
export const DEFAULT_BASE_URL = "https://cloud.mudbase.dev";

/** Normalized error thrown for any failed Mudbase API call. */
export class MudbaseApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown } = {}) {
    super(message);
    this.name = "MudbaseApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export interface MudbaseClientOptions {
  /** A Mudbase project or organization API key (X-API-Key). */
  apiKey: string;
  /** Override the API base URL. Defaults to https://cloud.mudbase.dev. */
  baseUrl?: string;
}

interface UploadFileParams {
  projectId: string;
  bucketId: string;
  filename: string;
  contentBase64: string;
  mimeType?: string;
  isPublic?: boolean;
}

/**
 * Thin, typed wrapper over the public Mudbase REST API. Every method maps to exactly one
 * documented endpoint; no client-side business logic beyond request shaping and error
 * normalization. Authenticates every request with the caller's API key, matching the same
 * X-API-Key header the Mudbase SDKs and REST docs use for programmatic access.
 */
export class MudbaseClient {
  private readonly http: AxiosInstance;

  constructor(options: MudbaseClientOptions) {
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new Error(
        "A Mudbase API key is required. Set the MUDBASE_API_KEY environment variable to a key " +
          "from your Mudbase project settings.",
      );
    }
    const baseURL = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.http = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        "X-API-Key": options.apiKey,
        Accept: "application/json",
      },
    });
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.http.request<T>(config);
      return response.data;
    } catch (error) {
      throw toMudbaseApiError(error);
    }
  }

  // ---- Collections (read-only schema access) ----

  listCollections(params: { projectId: string }): Promise<unknown> {
    return this.request({
      method: "GET",
      url: `/api/schemas/projects/${encodeURIComponent(params.projectId)}/collections`,
    });
  }

  getCollection(params: { projectId: string; collectionId: string }): Promise<unknown> {
    return this.request({
      method: "GET",
      url: `/api/schemas/projects/${encodeURIComponent(params.projectId)}/collections/${encodeURIComponent(
        params.collectionId,
      )}`,
    });
  }

  // ---- Documents (collection data CRUD) ----

  listDocuments(params: {
    projectId: string;
    collectionId: string;
    page?: number;
    limit?: number;
    sort?: string;
    filter?: string;
  }): Promise<unknown> {
    return this.request({
      method: "GET",
      url: `/api/data/projects/${encodeURIComponent(params.projectId)}/collections/${encodeURIComponent(
        params.collectionId,
      )}/data`,
      params: {
        page: params.page,
        limit: params.limit,
        sort: params.sort,
        filter: params.filter,
      },
    });
  }

  getDocument(params: { projectId: string; collectionId: string; documentId: string }): Promise<unknown> {
    return this.request({
      method: "GET",
      url: `/api/data/projects/${encodeURIComponent(params.projectId)}/collections/${encodeURIComponent(
        params.collectionId,
      )}/data/${encodeURIComponent(params.documentId)}`,
    });
  }

  createDocument(params: { projectId: string; collectionId: string; data: Record<string, unknown> }): Promise<unknown> {
    return this.request({
      method: "POST",
      url: `/api/data/projects/${encodeURIComponent(params.projectId)}/collections/${encodeURIComponent(
        params.collectionId,
      )}/data`,
      data: params.data,
    });
  }

  updateDocument(params: {
    projectId: string;
    collectionId: string;
    documentId: string;
    data: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request({
      method: "PATCH",
      url: `/api/data/projects/${encodeURIComponent(params.projectId)}/collections/${encodeURIComponent(
        params.collectionId,
      )}/data/${encodeURIComponent(params.documentId)}`,
      data: params.data,
    });
  }

  deleteDocument(params: { projectId: string; collectionId: string; documentId: string }): Promise<unknown> {
    return this.request({
      method: "DELETE",
      url: `/api/data/projects/${encodeURIComponent(params.projectId)}/collections/${encodeURIComponent(
        params.collectionId,
      )}/data/${encodeURIComponent(params.documentId)}`,
    });
  }

  // ---- Search ----

  searchDocuments(params: {
    projectId: string;
    query: string;
    collections?: string;
    fields?: string;
    page?: number;
    limit?: number;
  }): Promise<unknown> {
    return this.request({
      method: "GET",
      url: `/api/search/projects/${encodeURIComponent(params.projectId)}/search`,
      params: {
        q: params.query,
        collections: params.collections,
        fields: params.fields,
        page: params.page,
        limit: params.limit,
      },
    });
  }

  // ---- Storage (buckets and files) ----

  listBuckets(params: { projectId: string; search?: string; page?: number; limit?: number }): Promise<unknown> {
    return this.request({
      method: "GET",
      url: `/api/bucket/projects/${encodeURIComponent(params.projectId)}/buckets`,
      params: { search: params.search, page: params.page, limit: params.limit },
    });
  }

  listFiles(params: {
    projectId: string;
    bucketId: string;
    search?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<unknown> {
    return this.request({
      method: "GET",
      url: `/api/bucket/projects/${encodeURIComponent(params.projectId)}/buckets/${encodeURIComponent(
        params.bucketId,
      )}/files`,
      params: { search: params.search, type: params.type, page: params.page, limit: params.limit },
    });
  }

  getFile(params: { projectId: string; bucketId: string; fileId: string }): Promise<unknown> {
    return this.request({
      method: "GET",
      url: `/api/bucket/projects/${encodeURIComponent(params.projectId)}/buckets/${encodeURIComponent(
        params.bucketId,
      )}/files/${encodeURIComponent(params.fileId)}`,
    });
  }

  deleteFile(params: { projectId: string; bucketId: string; fileId: string }): Promise<unknown> {
    return this.request({
      method: "DELETE",
      url: `/api/bucket/projects/${encodeURIComponent(params.projectId)}/buckets/${encodeURIComponent(
        params.bucketId,
      )}/files/${encodeURIComponent(params.fileId)}`,
    });
  }

  getFileDownloadUrl(params: {
    projectId: string;
    bucketId: string;
    fileId: string;
    expiresIn?: number;
  }): Promise<unknown> {
    return this.request({
      method: "POST",
      url: `/api/bucket/projects/${encodeURIComponent(params.projectId)}/buckets/${encodeURIComponent(
        params.bucketId,
      )}/files/${encodeURIComponent(params.fileId)}/signed-url`,
      data: { expiresIn: params.expiresIn },
    });
  }

  async uploadFile(params: UploadFileParams): Promise<unknown> {
    const buffer = Buffer.from(params.contentBase64, "base64");
    if (buffer.length === 0) {
      throw new MudbaseApiError("contentBase64 decoded to an empty file. Nothing was uploaded.", {
        code: "empty_file",
      });
    }
    const form = new FormData();
    form.append("files", buffer, {
      filename: params.filename,
      contentType: params.mimeType || "application/octet-stream",
    });
    if (params.isPublic !== undefined) {
      form.append("isPublic", String(params.isPublic));
    }
    return this.request({
      method: "POST",
      url: `/api/bucket/projects/${encodeURIComponent(params.projectId)}/buckets/${encodeURIComponent(
        params.bucketId,
      )}/files`,
      data: form,
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  }
}

/** Turn any thrown error from an HTTP call into a normalized, human-readable MudbaseApiError. */
export function toMudbaseApiError(error: unknown): MudbaseApiError {
  if (error instanceof MudbaseApiError) {
    return error;
  }
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as Record<string, unknown> | undefined;
    const bodyMessage = typeof body?.error === "string" ? body.error : undefined;
    const code = typeof body?.code === "string" ? body.code : undefined;
    if (error.code === "ECONNABORTED") {
      return new MudbaseApiError("The request to Mudbase timed out.", { code: "timeout" });
    }
    if (!error.response) {
      return new MudbaseApiError(
        `Could not reach the Mudbase API (${error.message}). Check your network connection and the base URL.`,
        { code: "network_error" },
      );
    }
    if (status === 401 || status === 403) {
      return new MudbaseApiError(
        bodyMessage ??
          "Mudbase rejected this API key. Check that MUDBASE_API_KEY is a valid, active key with access to this project.",
        { status, code: code ?? "unauthorized", details: body },
      );
    }
    if (status === 429) {
      return new MudbaseApiError(bodyMessage ?? "Rate limited by Mudbase. Slow down and retry.", {
        status,
        code: code ?? "rate_limited",
        details: body,
      });
    }
    return new MudbaseApiError(bodyMessage ?? `Mudbase API request failed with status ${status}.`, {
      status,
      code,
      details: body,
    });
  }
  if (error instanceof Error) {
    return new MudbaseApiError(error.message);
  }
  return new MudbaseApiError("An unknown error occurred while calling the Mudbase API.");
}
