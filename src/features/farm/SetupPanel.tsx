/**
 * SetupPanel — OAuth token configuration and farm setup status.
 */

import { useState, useEffect } from 'react';

export function SetupPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/farm/setup/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const handleSave = async () => {
    if (!token.startsWith('sk-ant-')) {
      setMessage('Token must start with sk-ant-');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/farm/setup/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage('Token saved successfully');
        setToken('');
        const s = await fetch('/api/farm/setup/status').then((r) => r.json());
        setStatus(s);
      } else {
        setMessage(data.error || 'Failed to save');
      }
    } catch {
      setMessage('Failed to connect to API');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <h2 className="text-sm font-bold text-foreground tracking-tight">
            Farm Setup
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {status && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[0.733rem]">
                <span className={`h-2 w-2 rounded-full ${status.oauth ? 'bg-green' : 'bg-red'}`} />
                <span className="text-muted-foreground">
                  OAuth: {status.oauth ? 'Configured' : 'Not configured'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[0.733rem]">
                <span className={`h-2 w-2 rounded-full ${status.agents > 0 ? 'bg-green' : 'bg-yellow'}`} />
                <span className="text-muted-foreground">
                  Agents: {status.agents}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[0.733rem] text-muted-foreground font-medium">
              Claude OAuth Token
            </label>
            <p className="text-[0.667rem] text-muted-foreground/60">
              Long-lived token (sk-ant-oat01-...) from Claude Code setup.
              Shared by all agents on this farm.
            </p>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="sk-ant-oat01-..."
              className="w-full px-3 py-2 rounded-md text-[0.733rem] bg-background border border-border text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {message && (
            <p className={`text-[0.667rem] ${message.includes('success') ? 'text-green' : 'text-red'}`}>
              {message}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !token}
            className="w-full px-4 py-2 text-[0.733rem] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Token'}
          </button>
        </div>
      </div>
    </div>
  );
}
