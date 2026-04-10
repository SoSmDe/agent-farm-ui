/**
 * App.tsx - Main application layout component
 *
 * This component focuses on layout and composition.
 * Connection management is handled by useConnectionManager.
 * Dashboard data fetching is handled by useDashboardData.
 */
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import { AlertTriangle, CheckCircle2, RotateCw } from 'lucide-react';
import { useGateway } from '@/contexts/GatewayContext';
import { useSessionContext, type SpawnSessionOpts } from '@/contexts/SessionContext';
import { useChat } from '@/contexts/ChatContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getSessionKey } from '@/types';
import { useConnectionManager } from '@/hooks/useConnectionManager';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useGatewayRestart } from '@/hooks/useGatewayRestart';
const FarmDashboard = lazy(() => import('@/features/farm/FarmDashboard').then(m => ({ default: m.FarmDashboard })));
import { TopBar } from '@/components/TopBar';
import { StatusBar } from '@/components/StatusBar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ChatPanel, type ChatPanelHandle } from '@/features/chat/ChatPanel';
import type { ViewMode } from '@/features/command-palette/commands';
import { ResizablePanels } from '@/components/ResizablePanels';
import { getContextLimit } from '@/lib/constants';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { createCommands } from '@/features/command-palette/commands';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { SpawnAgentDialog } from '@/features/sessions/SpawnAgentDialog';
import { buildAgentRootSessionKey, getSessionDisplayLabel } from '@/features/sessions/sessionKeys';

// Lazy-loaded features (not needed in initial bundle)
const SettingsDrawer = lazy(() => import('@/features/settings/SettingsDrawer').then(m => ({ default: m.SettingsDrawer })));
const CommandPalette = lazy(() => import('@/features/command-palette/CommandPalette').then(m => ({ default: m.CommandPalette })));

// Lazy-loaded side panels
const SessionList = lazy(() => import('@/features/sessions/SessionList').then(m => ({ default: m.SessionList })));

interface AppProps {
  onLogout?: () => void;
}

export default function App({ onLogout }: AppProps) {
  // Gateway state
  const {
    connectionState, connectError, reconnectAttempt, model, sparkline,
  } = useGateway();

  // Session state
  const {
    sessions, sessionsLoading, currentSession, setCurrentSession,
    busyState, agentStatus, unreadSessions, refreshSessions, deleteSession, abortSession, spawnSession, renameSession,
    agentLogEntries, eventEntries,
    agentName,
  } = useSessionContext();

  // Chat state
  const {
    messages, isGenerating, stream, processingStage,
    lastEventTimestamp, activityLog, currentToolDescription,
    handleSend, handleAbort, handleReset,
    loadMore, hasMore,
    showResetConfirm, confirmReset, cancelReset,
  } = useChat();

  // Settings state
  const {
    soundEnabled, toggleSound,
    ttsProvider, ttsModel, setTtsProvider, setTtsModel,
    sttProvider, setSttProvider, sttInputMode, setSttInputMode, sttModel, setSttModel,
    wakeWordEnabled, handleToggleWakeWord, handleWakeWordState,
    liveTranscriptionPreview, toggleLiveTranscriptionPreview,
    panelRatio, setPanelRatio,
    eventsVisible, logVisible,
    toggleEvents, toggleLog, toggleTelemetry,
    setTheme, setFont,
  } = useSettings();

  // Connection management (extracted hook)
  const {
    dialogOpen,
    editableUrl, setEditableUrl,
    officialUrl,
    editableToken, setEditableToken,
    handleConnect, handleReconnect,
    serverSideAuth,
  } = useConnectionManager();

  // Responsive layout state (chat-first on smaller viewports)
  const initialCompactLayout = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
  const [isCompactLayout, setIsCompactLayout] = useState(initialCompactLayout);

  // Dashboard data (extracted hook)
  const { memories, memoriesLoading, tokenData, remoteWorkspace, refreshMemories } = useDashboardData({
    agentId: 'main',
    onFileChanged: () => {},
  });

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const [logGlow, setLogGlow] = useState(false);
  const [isMobileTopBarHidden, setIsMobileTopBarHidden] = useState(false);
  const [desktopRightPanelWidth, setDesktopRightPanelWidth] = useState<number | null>(null);
  const prevLogCount = useRef(0);
  const chatPanelRef = useRef<ChatPanelHandle>(null);

  // Gateway restart
  const {
    showGatewayRestartConfirm,
    gatewayRestarting,
    gatewayRestartNotice,
    handleGatewayRestart,
    cancelGatewayRestart,
    confirmGatewayRestart,
    dismissNotice,
  } = useGatewayRestart();

  // Command palette state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [spawnDialogOpen, setSpawnDialogOpen] = useState(false);

  // View mode state (chat | farm), persisted to localStorage
  const [viewMode, setViewModeRaw] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('nerve:viewMode');
      if (saved === 'farm') return saved;
    } catch { /* ignore */ }
    return 'farm';
  });
  const setViewMode = useCallback((mode: ViewMode) => {
    // Chat requires Gateway connection — block if not connected
    if (mode === 'chat' && connectionState !== 'connected') {
      setViewModeRaw('farm');
      try { localStorage.setItem('nerve:viewMode', 'farm'); } catch { /* ignore */ }
      return;
    }
    setViewModeRaw(mode);
    try { localStorage.setItem('nerve:viewMode', mode); } catch { /* ignore */ }
  }, [connectionState]);

  const toggleMobileTopBar = useCallback(() => {
    setIsMobileTopBarHidden((prev) => !prev);
  }, []);

  // Build command list with stable references
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const openSpawnDialog = useCallback(() => setSpawnDialogOpen(true), []);

  const commands = useMemo(() => createCommands({
    onNewSession: openSpawnDialog,
    onResetSession: handleReset,
    onToggleSound: toggleSound,
    onSettings: openSettings,
    onSearch: openSearch,
    onAbort: handleAbort,
    onSetTheme: setTheme,
    onSetFont: setFont,
    onTtsProviderChange: setTtsProvider,
    onToggleWakeWord: handleToggleWakeWord,
    onToggleEvents: toggleEvents,
    onToggleLog: toggleLog,
    onToggleTelemetry: toggleTelemetry,
    onOpenSettings: openSettings,
    onRefreshSessions: refreshSessions,
    onRefreshMemory: refreshMemories,
    onSetViewMode: setViewMode,
  }), [openSpawnDialog, handleReset, toggleSound, handleAbort, openSettings, openSearch,
    setTheme, setFont, setTtsProvider, handleToggleWakeWord, toggleEvents, toggleLog, toggleTelemetry,
    refreshSessions, refreshMemories, setViewMode]);

  // Keyboard shortcut handlers with useCallback
  const handleOpenPalette = useCallback(() => setPaletteOpen(true), []);
  const handleCtrlC = useCallback(() => {
    if (isGenerating) {
      handleAbort();
    }
  }, [isGenerating, handleAbort]);
  const toggleSearch = useCallback(() => setSearchOpen(prev => !prev), []);
  const handleEscape = useCallback(() => {
    if (paletteOpen) {
      setPaletteOpen(false);
    } else if (searchOpen) {
      setSearchOpen(false);
    } else if (isGenerating) {
      handleAbort();
    }
  }, [paletteOpen, searchOpen, isGenerating, handleAbort]);

  // Global keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'k', meta: true, handler: handleOpenPalette },
    { key: 'f', meta: true, handler: toggleSearch, skipInEditor: true },
    { key: 'c', ctrl: true, handler: handleCtrlC, preventDefault: false },
    { key: 'Escape', handler: handleEscape, skipInEditor: true },
  ]);

  // Get current session's context usage for StatusBar
  const currentSessionData = useMemo(() => {
    return sessions.find(s => getSessionKey(s) === currentSession);
  }, [sessions, currentSession]);

  // Get display name for current session (agent name for main, label for subagents)
  const currentSessionDisplayName = useMemo(() => {
    if (currentSessionData) return getSessionDisplayLabel(currentSessionData, agentName);
    return agentName;
  }, [currentSessionData, agentName]);

  const contextTokens = currentSessionData?.totalTokens ?? 0;
  const contextLimit = currentSessionData?.contextTokens || getContextLimit(model);

  const handleSessionChange = useCallback((key: string) => {
    setCurrentSession(key);
  }, [setCurrentSession]);

  const handleSpawnSession = useCallback((opts: SpawnSessionOpts) => {
    return spawnSession(opts);
  }, [spawnSession]);

  // Boot sequence: fade in panels when connected (or farm mode)
  useEffect(() => {
    if ((connectionState === 'connected' || viewMode === 'farm') && !booted) {
      const timer = setTimeout(() => setBooted(true), 50);
      return () => clearTimeout(timer);
    }
  }, [connectionState, viewMode, booted]);

  // Log header glow when new entries arrive
  useEffect(() => {
    const currentCount = agentLogEntries.length;
    if (currentCount > prevLogCount.current) {
      setLogGlow(true);
      const timer = setTimeout(() => setLogGlow(false), 500);
      prevLogCount.current = currentCount;
      return () => clearTimeout(timer);
    }
    prevLogCount.current = currentCount;
  }, [agentLogEntries.length]);

  const handleCompactLayoutChange = useCallback((nextIsCompactLayout: boolean) => {
    setIsCompactLayout(nextIsCompactLayout);
    if (!nextIsCompactLayout) {
      setIsMobileTopBarHidden(false);
    }
  }, []);

  // Responsive mode: switch to chat-first layout on smaller screens
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(max-width: 900px)');
    const onChange = (event: MediaQueryListEvent) => {
      handleCompactLayoutChange(event.matches);
    };

    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    // Safari fallback
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [handleCompactLayoutChange]);

  const compactSessionsPanel = (
    <Suspense fallback={<div className="p-4 text-muted-foreground text-xs">Loading sessions...</div>}>
      <PanelErrorBoundary name="Sessions">
        <SessionList
          sessions={sessions}
          currentSession={currentSession}
          busyState={busyState}
          agentStatus={agentStatus}
          unreadSessions={unreadSessions}
          onSelect={handleSessionChange}
          onRefresh={refreshSessions}
          onDelete={deleteSession}
          onSpawn={handleSpawnSession}
          onRename={renameSession}
          onAbort={abortSession}
          isLoading={sessionsLoading}
          agentName={agentName}
          compact
        />
      </PanelErrorBoundary>
    </Suspense>
  );

  const chatContent = (
    <PanelErrorBoundary name="Chat">
      <ChatPanel
        ref={chatPanelRef}
        id="main-chat"
        messages={messages}
        onSend={handleSend}
        onAbort={handleAbort}
        isGenerating={isGenerating}
        stream={stream}
        processingStage={processingStage}
        lastEventTimestamp={lastEventTimestamp}
        currentToolDescription={currentToolDescription}
        activityLog={activityLog}
        onWakeWordState={handleWakeWordState}
        onReset={handleReset}
        searchOpen={searchOpen}
        onSearchClose={closeSearch}
        agentName={currentSessionDisplayName}
        loadMore={loadMore}
        hasMore={hasMore}
        onToggleMobileTopBar={isCompactLayout ? toggleMobileTopBar : undefined}
        isMobileTopBarHidden={isMobileTopBarHidden}
      />
    </PanelErrorBoundary>
  );

  const renderRightPanels = (onSelect: (key: string) => Promise<void> | void) => (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-background">Loading...</div>}>
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        <div className="shell-panel flex-1 flex flex-col min-h-0 overflow-hidden rounded-[28px]">
          <PanelErrorBoundary name="Sessions">
            <SessionList
              sessions={sessions}
              currentSession={currentSession}
              busyState={busyState}
              agentStatus={agentStatus}
              unreadSessions={unreadSessions}
              onSelect={onSelect}
              onRefresh={refreshSessions}
              onDelete={deleteSession}
              onSpawn={handleSpawnSession}
              onRename={renameSession}
              onAbort={abortSession}
              isLoading={sessionsLoading}
              agentName={agentName}
            />
          </PanelErrorBoundary>
        </div>
      </div>
    </Suspense>
  );

  return (
    <div className="scan-lines relative h-screen flex flex-col overflow-hidden" data-booted={booted}>
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-chat"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:font-bold focus:text-sm"
      >
        Skip to chat
      </a>

      {/*
       * Gateway state banners.
       * Kept compact and centered so they read as transient shell notices instead of old alarm strips.
       */}
      {connectionState === 'reconnecting' && !gatewayRestarting && (
        <div className="fixed left-1/2 top-12 z-50 flex max-w-[calc(100vw-1.067rem)] -translate-x-1/2 items-start gap-2 rounded-2xl border border-destructive/25 bg-card/94 px-4 py-2 text-xs font-medium text-foreground shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <span className="inline-flex size-7 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle size={14} aria-hidden="true" />
          </span>
          <span className="min-w-0 text-left leading-5">
            Signal lost. Reconnecting{reconnectAttempt > 1 ? `, attempt ${reconnectAttempt}` : ''}.
          </span>
          <span className="size-2 rounded-full bg-destructive animate-pulse" aria-hidden="true" />
        </div>
      )}

      {gatewayRestarting && (
        <div className="fixed left-1/2 top-12 z-50 flex max-w-[calc(100vw-1.067rem)] -translate-x-1/2 items-start gap-2 rounded-2xl border border-orange/25 bg-card/94 px-4 py-2 text-xs font-medium text-foreground shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <span className="inline-flex size-7 items-center justify-center rounded-xl bg-orange/10 text-orange">
            <RotateCw size={14} className="animate-spin" aria-hidden="true" />
          </span>
          <span className="min-w-0 text-left leading-5">Gateway restarting...</span>
        </div>
      )}

      {!gatewayRestarting && gatewayRestartNotice && (
        <button
          type="button"
          onClick={dismissNotice}
          className={`fixed left-1/2 top-12 z-50 flex max-w-[calc(100vw-1.067rem)] -translate-x-1/2 cursor-pointer items-start gap-2 rounded-2xl border px-4 py-2 text-xs font-medium shadow-[0_20px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-transform hover:-translate-x-1/2 hover:-translate-y-px ${
            gatewayRestartNotice.ok
              ? 'border-green/25 bg-card/94 text-foreground'
              : 'border-destructive/25 bg-card/94 text-foreground'
          }`}
        >
          <span className={`inline-flex size-7 items-center justify-center rounded-xl ${
            gatewayRestartNotice.ok ? 'bg-green/10 text-green' : 'bg-destructive/10 text-destructive'
          }`}>
            {gatewayRestartNotice.ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
          </span>
          <span className="min-w-0 text-left leading-5">{gatewayRestartNotice.message}</span>
        </button>
      )}

      {/* TopBar removed — Agent Farm dashboard has its own header */}

      <PanelErrorBoundary name="Settings">
        <Suspense fallback={null}>
          <SettingsDrawer
            open={settingsOpen}
            onClose={closeSettings}
            gatewayUrl={editableUrl}
            gatewayToken={editableToken}
            onUrlChange={setEditableUrl}
            onTokenChange={setEditableToken}
            onReconnect={handleReconnect}
            connectionState={connectionState}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            ttsProvider={ttsProvider}
            ttsModel={ttsModel}
            onTtsProviderChange={setTtsProvider}
            onTtsModelChange={setTtsModel}
            sttProvider={sttProvider}
            sttInputMode={sttInputMode}
            sttModel={sttModel}
            onSttProviderChange={setSttProvider}
            onSttInputModeChange={setSttInputMode}
            onSttModelChange={setSttModel}
            wakeWordEnabled={wakeWordEnabled}
            onToggleWakeWord={handleToggleWakeWord}
            liveTranscriptionPreview={liveTranscriptionPreview}
            onToggleLiveTranscriptionPreview={toggleLiveTranscriptionPreview}
            agentName={agentName}
            onLogout={onLogout}
            onGatewayRestart={handleGatewayRestart}
            gatewayRestarting={gatewayRestarting}
          />
        </Suspense>
      </PanelErrorBoundary>

      <div className="flex-1 flex gap-3 overflow-hidden min-h-0 px-2 pt-1.5 pb-2 sm:px-4 sm:pt-2 sm:pb-2">
        {viewMode === 'farm' && (
          <div className="shell-panel boot-panel flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden rounded-[28px]">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-xs bg-background">Loading...</div>}>
              <FarmDashboard />
            </Suspense>
          </div>
        )}
        {isCompactLayout ? (
          <div className={`shell-panel flex-1 min-w-0 min-h-0 overflow-hidden rounded-[28px] boot-panel${viewMode === 'farm' ? ' hidden' : ''}`}>
            {chatContent}
          </div>
        ) : (
          <div style={{ display: viewMode === 'farm' ? 'none' : 'contents' }}>
            <ResizablePanels
              leftPercent={panelRatio}
              onResize={setPanelRatio}
              minLeftPercent={30}
              maxLeftPercent={85}
              rightWidthPx={desktopRightPanelWidth}
              leftClassName="shell-panel boot-panel rounded-[28px] overflow-hidden"
              rightClassName="boot-panel flex flex-col"
              left={chatContent}
              right={renderRightPanels(handleSessionChange)}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="boot-panel" style={{ transitionDelay: '200ms' }}>
        <StatusBar
          connectionState={connectionState}
          sessionCount={sessions.length}
          sparkline={sparkline}
          contextTokens={contextTokens}
          contextLimit={contextLimit}
        />
      </div>

      {/* Command Palette */}
      <PanelErrorBoundary name="Command Palette">
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onClose={closePalette}
            commands={commands}
          />
        </Suspense>
      </PanelErrorBoundary>

      {/* Reset Session Confirmation */}
      <ConfirmDialog
        open={showResetConfirm}
        title="Reset Session"
        message="This will start fresh and clear all context."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={confirmReset}
        onCancel={cancelReset}
        variant="danger"
      />

      {/* Gateway Restart Confirmation */}
      <ConfirmDialog
        open={showGatewayRestartConfirm}
        title="Restart Gateway"
        message="This will briefly interrupt gateway connectivity. Continue?"
        confirmLabel="Restart"
        cancelLabel="Cancel"
        onConfirm={confirmGatewayRestart}
        onCancel={cancelGatewayRestart}
        variant="warning"
      />

      {/* Spawn Agent Dialog (from command palette) */}
      <SpawnAgentDialog
        open={spawnDialogOpen}
        onOpenChange={setSpawnDialogOpen}
        onSpawn={handleSpawnSession}
      />
    </div>
  );
}
