import { describe, expect, it } from 'vitest';
import { buildPagePrompt } from './pagePrompt';

describe('buildPagePrompt', () => {
  it('always states the page/feature and closes with the views hand-off', () => {
    const prompt = buildPagePrompt({
      pageWant: 'a leaderboard of the most active students',
      readsNeeded: false,
      eventNeeded: false,
    });
    expect(prompt).toContain('a leaderboard of the most active students');
    expect(prompt).toContain('Your views');
  });

  it('falls back to a placeholder when nothing is described', () => {
    expect(buildPagePrompt({ pageWant: '  ', readsNeeded: false, eventNeeded: false })).toContain(
      'describe the page or feature',
    );
  });

  describe('reads block (describe-only — the agent picks the table)', () => {
    it('is included and instructs an athenaQuery read when the page needs data', () => {
      const prompt = buildPagePrompt({
        pageWant: 'homework completion per class',
        readsNeeded: true,
        dataWant: 'completion this week, per class',
        eventNeeded: false,
      });
      expect(prompt).toContain('DATA THIS PAGE READS');
      expect(prompt).toContain('completion this week, per class');
      expect(prompt).toContain('synapse.athenaQuery');
      // Never guess/bake a table name — no backticked identifier.
      expect(prompt).not.toContain('`');
    });

    it('inherits the page description when no separate data description is given', () => {
      const prompt = buildPagePrompt({
        pageWant: 'homework completion per class',
        readsNeeded: true,
        eventNeeded: false,
      });
      expect(prompt).toContain('Show: homework completion per class.');
    });

    it('is omitted when the page reads no data', () => {
      const prompt = buildPagePrompt({
        pageWant: 'a static about page',
        readsNeeded: false,
        eventNeeded: false,
      });
      expect(prompt).not.toContain('DATA THIS PAGE READS');
    });
  });

  describe('events block (catalog-anchored — reuse or declare)', () => {
    it('is included and instructs declare + publish when the page triggers something', () => {
      const prompt = buildPagePrompt({
        pageWant: 'a nudge button',
        readsNeeded: false,
        eventNeeded: true,
        eventWant: 'a teacher nudges a student',
        reuseEventType: 'task.created',
      });
      expect(prompt).toContain('WHAT THIS PAGE TRIGGERS');
      expect(prompt).toContain('a teacher nudges a student');
      expect(prompt).toContain('task.created'); // the advisory catalog candidate
      expect(prompt).toContain('synapse.declareEvent');
      expect(prompt).toContain('synapse.publishEvent');
    });

    it('is omitted when the page triggers nothing', () => {
      const prompt = buildPagePrompt({
        pageWant: 'a read-only dashboard',
        readsNeeded: true,
        eventNeeded: false,
      });
      expect(prompt).not.toContain('WHAT THIS PAGE TRIGGERS');
    });
  });

  it('includes both blocks for a page that reads data and fires an event', () => {
    const prompt = buildPagePrompt({
      pageWant: 'homework health with a nudge button',
      readsNeeded: true,
      dataWant: 'completion per class',
      eventNeeded: true,
      eventWant: 'a teacher nudges a student',
    });
    expect(prompt).toContain('DATA THIS PAGE READS');
    expect(prompt).toContain('WHAT THIS PAGE TRIGGERS');
  });
});
