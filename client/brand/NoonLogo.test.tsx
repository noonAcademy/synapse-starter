// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoonLogo } from './NoonLogo';

describe('NoonLogo', () => {
  it('draws the word with the face in the app colour and letters in the theme ink', () => {
    const { container } = render(<NoonLogo className="h-6" />);
    expect(screen.getByRole('img', { name: 'noon' }).getAttribute('class')).toBe('h-6');
    expect(container.querySelector('circle')?.getAttribute('class')).toBe('fill-face');
    expect(container.querySelector('g')?.getAttribute('class')).toBe('fill-logo-ink');
    expect(container.querySelectorAll('path')).toHaveLength(4);
  });

  it('draws only the face and smile for the mark', () => {
    const { container } = render(<NoonLogo variant="mark" title="Finance" />);
    expect(screen.getByRole('img', { name: 'Finance' })).toBeTruthy();
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('66.5 -3.3 64 64');
  });
});
