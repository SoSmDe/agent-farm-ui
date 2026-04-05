/**
 * TTS config stub — voice features removed from Agent Farm.
 */

export interface TTSVoiceConfig {
  qwen: {
    mode: string;
    language: string;
    speaker: string;
    voiceDescription: string;
    styleInstruction: string;
  };
  openai: {
    model: string;
    voice: string;
    instructions: string;
  };
  edge: {
    voice: string;
  };
  xiaomi: {
    model: string;
    voice: string;
    style: string;
  };
}

interface UseTTSConfigReturn {
  config: TTSVoiceConfig | null;
  loading: boolean;
  error: string | null;
  saved: boolean;
  updateField: (provider: keyof TTSVoiceConfig, field: string, value: string) => void;
}

/** No-op TTS config hook. */
export function useTTSConfig(): UseTTSConfigReturn {
  return {
    config: null,
    loading: false,
    error: null,
    saved: false,
    updateField: () => {},
  };
}
