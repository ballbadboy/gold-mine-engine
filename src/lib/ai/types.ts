export type ProviderName = 'claude' | 'gemini' | 'openrouter';

export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface GenerateOptions {
  model?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: false;
  signal?: AbortSignal;
  maxRetries?: number;
}

export interface GenerateResult {
  provider: ProviderName;
  model: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  raw?: unknown;
}

export interface LLMProvider {
  readonly name: ProviderName;
  readonly defaultModel: string;
  isConfigured(): boolean;
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult>;
}
