import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './app/AppShell';
import { ConsoleApp } from './console/ConsoleApp';
import { WorkspaceLock } from './console/WorkspaceLock';
import { refusedWorkspaceKey, useSynapseMode } from './useSynapseMode';
import { installWorkspaceKey, UNLOCKED_EVENT } from './workspaceKey';
import './index.css';

installWorkspaceKey();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// The single hinge of the two-part split: probe whether we're in the workspace (render the builder
// console) or a published deployment (render the shipped app).
function Root() {
  const mode = useSynapseMode();
  if (mode === 'probing') {
    return <Splash />;
  }
  if (mode === 'locked') {
    return <WorkspaceLock refusedKey={refusedWorkspaceKey()} />;
  }
  return mode === 'workspace' ? <ConsoleApp /> : <AppShell />;
}

// Brand-neutral holding screen for the one-request probe, so end users never glimpse console chrome.
function Splash() {
  return <div className="min-h-screen bg-slate-50" aria-hidden />;
}

// A new key (pasted, or from the link) remounts Root, which probes again with it.
function App() {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const retry = () => setAttempt((n) => n + 1);
    window.addEventListener(UNLOCKED_EVENT, retry);
    return () => window.removeEventListener(UNLOCKED_EVENT, retry);
  }, []);
  return <Root key={attempt} />;
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
