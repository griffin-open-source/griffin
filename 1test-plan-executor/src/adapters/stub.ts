import type { HttpClientAdapter, HttpRequest, HttpResponse } from "../types.js";

export interface StubResponse {
  /** URL pattern to match (string for exact, RegExp for pattern, or function for custom logic) */
  match: string | RegExp | ((req: HttpRequest) => boolean);
  response: HttpResponse;
}

export class StubAdapter implements HttpClientAdapter {
  private stubs: StubResponse[] = [];

  /**
   * Add a stub response for matching requests
   * @param stub - The stub configuration
   * @returns this (for chaining)
   */
  addStub(stub: StubResponse): this {
    this.stubs.push(stub);
    return this;
  }

  /**
   * Clear all configured stubs
   */
  clearStubs(): void {
    this.stubs = [];
  }

  async request(req: HttpRequest): Promise<HttpResponse> {
    for (const stub of this.stubs) {
      if (this.matches(stub.match, req)) {
        return stub.response;
      }
    }
    throw new Error(`No stub matched request: ${req.method} ${req.url}`);
  }

  private matches(match: StubResponse["match"], req: HttpRequest): boolean {
    if (typeof match === "string") {
      return req.url === match;
    }
    if (match instanceof RegExp) {
      return match.test(req.url);
    }
    return match(req);
  }
}
