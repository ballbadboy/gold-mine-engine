import { ClaudeProvider } from './claude';
import { GeminiProvider } from './gemini';
import { OpenRouterProvider } from './openrouter';
import type { ChatMessage, GenerateOptions, GenerateResult, LLMProvider, ProviderName } from './types';

export type { ChatMessage, GenerateOptions, GenerateResult, LLMProvider, ProviderName };

/**
 * Provider preference order (primary → fallback).
 * Claude = best reasoning, Gemini = cheap bulk, OpenRouter = swap anytime.
 */
const PREFERENCE: ProviderName[] = ['claude', 'gemini', 'openrouter'];

let registry: Map<ProviderName, LLMProvider> | null = null;

function getRegistry(): Map<ProviderName, LLMProvider> {
  if (!registry) {
    registry = new Map<ProviderName, LLMProvider>([
      ['claude', new ClaudeProvider()],
      ['gemini', new GeminiProvider()],
      ['openrouter', new OpenRouterProvider()],
    ]);
  }
  return registry;
}

/**
 * Return all providers with their configuration status.
 * Used by /api/ai/status and dashboard.
 */
export function listProviders(): Array<{ name: ProviderName; configured: boolean; model: string }> {
  return PREFERENCE.map((name) => {
    const p = getRegistry().get(name)!;
    return { name, configured: p.isConfigured(), model: p.defaultModel };
  });
}

/**
 * Get a specific provider or auto-pick the first configured one (by preference).
 * Throws if no provider is configured.
 */
export function getLLM(preferred?: ProviderName): LLMProvider {
  const reg = getRegistry();
  if (preferred) {
    const p = reg.get(preferred);
    if (!p) throw new Error(`Unknown provider: ${preferred}`);
    if (!p.isConfigured()) throw new Error(`Provider ${preferred} is not configured`);
    return p;
  }
  for (const name of PREFERENCE) {
    const p = reg.get(name)!;
    if (p.isConfigured()) return p;
  }
  throw new Error('No LLM provider configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY or OPENROUTER_API_KEY.');
}

/**
 * Convenience: generate with automatic fallback.
 * Try preferred → next-configured on error. Returns first success.
 */
export async function generate(
  messages: ChatMessage[],
  options: GenerateOptions & { provider?: ProviderName } = {}
): Promise<GenerateResult> {
  const { provider, ...genOpts } = options;
  const tried: Array<{ name: ProviderName; error: string }> = [];
  const order = provider ? [provider] : PREFERENCE;

  for (const name of order) {
    const p = getRegistry().get(name);
    if (!p || !p.isConfigured()) continue;
    try {
      return await p.generate(messages, genOpts);
    } catch (e: unknown) {
      tried.push({ name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  throw new Error(`All providers failed: ${JSON.stringify(tried)}`);
}
