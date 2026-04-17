import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, GenerateOptions, GenerateResult, LLMProvider } from './types';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude' as const;
  readonly defaultModel = DEFAULT_MODEL;

  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  private getClient(): Anthropic {
    if (!this.client) {
      if (!this.isConfigured()) throw new Error('ANTHROPIC_API_KEY not set');
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  async generate(messages: ChatMessage[], options: GenerateOptions = {}): Promise<GenerateResult> {
    const model = options.model ?? DEFAULT_MODEL;
    const started = Date.now();

    // Anthropic requires system as top-level param; map other messages.
    const systemFromMessages = messages.find((m) => m.role === 'system')?.content;
    const system = options.system ?? systemFromMessages;
    const nonSystem = messages.filter((m) => m.role !== 'system');

    const response = await this.getClient().messages.create({
      model,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      system,
      messages: nonSystem.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return {
      provider: this.name,
      model,
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - started,
      raw: response,
    };
  }
}
