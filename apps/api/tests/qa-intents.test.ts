import { describe, expect, it } from 'vitest';

import { classifyQuestion } from '../src/qa/intents.js';

describe('qa intent classifier', () => {
  it('matches top scorer questions', () => {
    const intent = classifyQuestion('Who are the top scorers in 2024-25?');
    expect(intent.type).toBe('TOP_SCORERS_SEASON');
  });

  it('matches player average points last N games', () => {
    const intent = classifyQuestion('What is the average points for Jayson Tatum last 8 games in 2024-25?');
    expect(intent.type).toBe('PLAYER_AVG_POINTS_LAST_N_GAMES');
    expect(intent.params.lastNGames).toBe(8);
  });

  it('matches team net rating trend', () => {
    const intent = classifyQuestion('Show net rating trend for Boston Celtics in 2024-25');
    expect(intent.type).toBe('TEAM_NET_RATING_TREND');
  });

  it('falls back to unknown intent', () => {
    const intent = classifyQuestion('Tell me something surprising about basketball history.');
    expect(intent.type).toBe('UNKNOWN');
  });
});
