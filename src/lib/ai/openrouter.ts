import OpenAI from 'openai';
import type { ChatMessage, GenerateOptions, GenerateResult, LLMProvider } from './types';

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6';

export class OpenRouterProvider implements LLMProvider {
  readonly name = 'openrouter' as const;
  readonly defaultModel = DEFAULT_MODEL;

  private client: OpenAI | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!this.isConfigured()) throw new Error('OPENROUTER_API_KEY not set');
      this.client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY!,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
          'X-Title': 'Gold Mine Engine',
        },
      });
    }
    return this.client;
  }

  async generate(messages: ChatMessage[], options: GenerateOptions = {}): Promise<GenerateResult> {
    const model = options.model ?? DEFAULT_MODEL;
    const started = Date.now();

    // OpenRouter uses OpenAI format — system as a message is fine
    const oaMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (options.system) oaMessages.push({ role: 'system', content: options.system });
    for (const m of messages) {
      oaMessages.push({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content,
      });
    }

    const response = await this.getClient().chat.completions.create({
      model,
      messages: oaMessages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
    });

    const text = response.choices[0]?.message?.content ?? '';

    return {
      provider: this.name,
      model,
      text,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
      raw: response,
    };
  }
}
