export interface ExecutionOptions {
  mode: 'local' | 'remote';
  baseUrl?: string;
  timeout?: number;
}

export interface NodeResult {
  nodeId: string;
  success: boolean;
  response?: any;
  error?: string;
  duration_ms: number;
}

export interface ExecutionResult {
  success: boolean;
  results: NodeResult[];
  errors: string[];
  totalDuration_ms: number;
}
