/**
 * Voice input stub — voice features removed from Agent Farm.
 */
import type { STTInputMode } from '@/contexts/SettingsContext';

export function invalidatePhrasesCache(): void {}

export type VoiceState = 'idle' | 'listening' | 'recording' | 'transcribing';

export const LANG_TO_BCP47: Record<string, string> = {};

export function resolveRecognitionLang(language: string): string {
  return language;
}

export function useVoiceInput(
  _onTranscription: (text: string) => void,
  _agentName?: string,
  _language?: string,
  _phrasesVersion?: number,
  _sttInputMode?: STTInputMode,
) {
  return {
    voiceState: 'idle' as VoiceState,
    interimTranscript: '',
    startRecording: () => {},
    stopAndTranscribe: () => {},
    discardRecording: () => {},
    wakeWordEnabled: false,
    toggleWakeWord: () => {},
    startWakeWordListener: () => {},
    stopWakeWordListener: () => {},
    error: null as string | null,
    clearError: () => {},
  };
}
