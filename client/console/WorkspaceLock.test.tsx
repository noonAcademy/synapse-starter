// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { saveWorkspaceKey, storedWorkspaceKey, UNLOCKED_EVENT } from '../workspaceKey';
import { WorkspaceLock } from './WorkspaceLock';

describe('WorkspaceLock', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('asks for the key when this browser has none', () => {
    render(<WorkspaceLock refusedKey={null} />);
    expect(screen.getByText('This workspace is locked to you')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says a refused key did not work, and forgets it', () => {
    saveWorkspaceKey('an-old-rotated-key');
    render(<WorkspaceLock refusedKey="an-old-rotated-key" />);
    expect(screen.getByRole('alert').textContent).toMatch(/That key did not work/);
    expect(storedWorkspaceKey()).toBeNull();
  });

  it('tries a key another tab saved when the refused probe sent none', () => {
    saveWorkspaceKey('newer-key');
    let unlocked = 0;
    const count = () => {
      unlocked += 1;
    };
    window.addEventListener(UNLOCKED_EVENT, count);
    render(<WorkspaceLock refusedKey={null} />);
    window.removeEventListener(UNLOCKED_EVENT, count);
    expect(storedWorkspaceKey()).toBe('newer-key');
    expect(unlocked).toBeGreaterThan(0);
  });

  it('keeps a newer key another tab saved while the refused probe was in flight', () => {
    saveWorkspaceKey('newer-key');
    let unlocked = 0;
    const count = () => {
      unlocked += 1;
    };
    window.addEventListener(UNLOCKED_EVENT, count);
    render(<WorkspaceLock refusedKey="an-old-rotated-key" />);
    window.removeEventListener(UNLOCKED_EVENT, count);
    expect(storedWorkspaceKey()).toBe('newer-key');
    expect(unlocked).toBeGreaterThan(0);
  });
});
