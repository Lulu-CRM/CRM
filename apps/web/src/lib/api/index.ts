import { mockApi } from "./mock";
import { realApi } from "./real";

export { ApiError, type ListResult } from "./types";
export { setAuthToken } from "./http";

// NEXT_PUBLIC_USE_MOCK=true serves the design's sample data, so pages work before the API is ready.
export const useMock = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export const api: typeof realApi = useMock ? mockApi : realApi;
