/**
 * Wake word support stub — voice features removed from Agent Farm.
 */

export interface WakeWordSupportEnv {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

export interface WakeWordSupportResult {
  supported: boolean;
  reason: 'mobile-web' | null;
}

export function getWakeWordSupport(_env?: WakeWordSupportEnv): WakeWordSupportResult {
  return { supported: false, reason: null };
}
