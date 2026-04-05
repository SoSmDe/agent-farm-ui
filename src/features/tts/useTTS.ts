/**
 * TTS stub — voice features removed from Agent Farm.
 * Kept as a minimal type export so SettingsContext compiles.
 */

export type TTSProvider = 'edge' | 'openai' | 'replicate' | 'xiaomi';

/** No-op migration — returns provider as-is or defaults to 'edge'. */
export function migrateTTSProvider(raw: string | null): TTSProvider {
  const valid: TTSProvider[] = ['edge', 'openai', 'replicate', 'xiaomi'];
  if (raw && valid.includes(raw as TTSProvider)) return raw as TTSProvider;
  return 'edge';
}

export type LegacyTTSProvider = 'qwen';

/** No-op TTS marker extraction — returns text as-is. */
export function extractTTSMarkers(text: string): { cleaned: string; ttsText: string | null } {
  return { cleaned: text, ttsText: null };
}

/** No-op TTS hook — speak() does nothing. */
export function useTTS(_enabled: boolean, _provider: TTSProvider, _model?: string) {
  return {
    speak: (_text: string) => {},
    stop: () => {},
    isSpeaking: false,
  };
}
