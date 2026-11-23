// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { saveWorkspaceKey, storedWorkspaceKey } from '../workspaceKey';
import { WorkspaceLock } from './WorkspaceLock';

describe('WorkspaceLock', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('asks for the key when this browser has none', () => {
    render(<WorkspaceLock />);
    expect(screen.getByText('This workspace is locked to you')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says a refused key did not work, and forgets it', () => {
    saveWorkspaceKey('an-old-rotated-key');
    render(<WorkspaceLock />);
    expect(screen.getByRole('alert').textContent).toMatch(/That key did not work/);
    expect(storedWorkspaceKey()).toBeNull();
  });
});
