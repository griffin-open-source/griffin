import axios from "axios";
import type { HttpClientAdapter, HttpRequest, HttpResponse } from "../types.js";

export class AxiosAdapter implements HttpClientAdapter {
  async request(req: HttpRequest): Promise<HttpResponse> {
    try {
      const response = await axios({
        method: req.method,
        url: req.url,
        headers: req.headers,
        data: req.body,
        timeout: req.timeout,
      });

      return {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers as Record<string, string>,
      };
    } catch (error: unknown) {
      // Re-throw axios errors with additional context
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED") {
          throw new Error(
            `Connection refused - is the server running on ${req.url}?`,
          );
        }
        if (error.code === "ETIMEDOUT") {
          throw new Error(`Request timed out after ${req.timeout}ms`);
        }
        if (error.response) {
          throw new Error(
            `HTTP ${error.response.status}: ${error.response.statusText}`,
          );
        }
      }
      throw error;
    }
  }
}
