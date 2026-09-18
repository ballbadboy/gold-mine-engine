import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage, GenerateOptions, GenerateResult, LLMProvider } from './types';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini' as const;
  readonly defaultModel = DEFAULT_MODEL;

  private client: GoogleGenerativeAI | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      if (!this.isConfigured()) throw new Error('GEMINI_API_KEY not set');
      this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    }
    return this.client;
  }

  async generate(messages: ChatMessage[], options: GenerateOptions = {}): Promise<GenerateResult> {
    const modelName = options.model ?? DEFAULT_MODEL;
    const started = Date.now();

    const systemFromMessages = messages.find((m) => m.role === 'system')?.content;
    const system = options.system ?? systemFromMessages;
    const nonSystem = messages.filter((m) => m.role !== 'system');

    const model = this.getClient().getGenerativeModel({
      model: modelName,
      systemInstruction: system,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
      },
    });

    // Gemini expects role: 'user' | 'model'; convert assistant -> model
    const history = nonSystem.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const last = nonSystem[nonSystem.length - 1];
    if (!last) throw new Error('No user message provided');

    const chat = model.startChat({ history });
    const response = await chat.sendMessage(last.content, { signal: options.signal });
    const text = response.response.text();
    const usage = response.response.usageMetadata;

    return {
      provider: this.name,
      model: modelName,
      text,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - started,
      raw: response,
    };
  }
}
