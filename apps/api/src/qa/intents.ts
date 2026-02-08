export type QaIntentType =
  | 'TOP_SCORERS_SEASON'
  | 'PLAYER_AVG_POINTS_LAST_N_GAMES'
  | 'TEAM_NET_RATING_TREND'
  | 'UNKNOWN';

export interface QaIntent {
  type: QaIntentType;
  confidence: number;
  params: Record<string, unknown>;
}

function extractSeason(question: string): string | undefined {
  const match = question.match(/\b(20\d{2}-\d{2})\b/);
  return match?.[1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractLastNGames(question: string): number {
  const match = question.match(/last\s+(\d{1,2})\s+games?/i);
  if (!match) {
    return 10;
  }
  return clamp(Number(match[1]), 3, 30);
}

function extractPlayerName(question: string): string | undefined {
  const explicit = question.match(/(?:for|of)\s+([A-Za-z .'-]+?)(?:\s+last\s+\d+|\?|$)/i);
  if (explicit?.[1]) {
    return explicit[1].trim();
  }

  const heuristic = question.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
  return heuristic?.[1]?.trim();
}

function extractTeamName(question: string): string | undefined {
  const explicit = question.match(/(?:for|of)\s+([A-Za-z .'-]+?)(?:\s+(?:in|during|this|last)|\?|$)/i);
  if (explicit?.[1]) {
    return explicit[1].trim();
  }

  const withTeam = question.match(/team\s+([A-Za-z .'-]+?)(?:\?|$)/i);
  return withTeam?.[1]?.trim();
}

export function classifyQuestion(question: string): QaIntent {
  const normalized = question.toLowerCase();
  const season = extractSeason(question);

  if ((/top|leading/.test(normalized) && /scorer|points|ppg/.test(normalized)) || /top scorers/.test(normalized)) {
    return {
      type: 'TOP_SCORERS_SEASON',
      confidence: 0.93,
      params: {
        season,
        limit: 10
      }
    };
  }

  if ((/average|avg/.test(normalized) && /points|ppg/.test(normalized)) || /last\s+\d+\s+games?/.test(normalized)) {
    const playerName = extractPlayerName(question);
    if (playerName) {
      return {
        type: 'PLAYER_AVG_POINTS_LAST_N_GAMES',
        confidence: 0.87,
        params: {
          playerName,
          lastNGames: extractLastNGames(question),
          season
        }
      };
    }
  }

  if (/net rating/.test(normalized) && (/trend/.test(normalized) || /team/.test(normalized))) {
    const teamName = extractTeamName(question);
    if (teamName) {
      return {
        type: 'TEAM_NET_RATING_TREND',
        confidence: 0.84,
        params: {
          teamName,
          season,
          limit: 20
        }
      };
    }
  }

  return {
    type: 'UNKNOWN',
    confidence: 0.2,
    params: {}
  };
}
