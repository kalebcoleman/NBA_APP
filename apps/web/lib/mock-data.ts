// TODO: replace with real API — all data here is mock fallback until backend endpoints are ready

import type {
  PlayerSummary,
  PlayerDetail,
  GameLogEntry,
  ShotData,
  TeamSummary,
  TeamDetail,
  LeaderboardEntry,
  ComparisonPlayer,
} from "./types";

export const mockPlayers: PlayerSummary[] = [
  { playerId: "203999", name: "Nikola Jokic", team: "DEN", teamId: "1610612743", position: "C", ppg: 26.4, rpg: 12.4, apg: 9.0 },
  { playerId: "1629029", name: "Luka Doncic", team: "DAL", teamId: "1610612742", position: "G", ppg: 28.1, rpg: 8.3, apg: 8.8 },
  { playerId: "1628983", name: "Shai Gilgeous-Alexander", team: "OKC", teamId: "1610612760", position: "G", ppg: 31.2, rpg: 5.5, apg: 6.2 },
  { playerId: "201142", name: "Kevin Durant", team: "PHX", teamId: "1610612756", position: "F", ppg: 27.3, rpg: 6.5, apg: 5.2 },
  { playerId: "203507", name: "Giannis Antetokounmpo", team: "MIL", teamId: "1610612749", position: "F", ppg: 30.4, rpg: 11.5, apg: 6.5 },
  { playerId: "1629630", name: "Ja Morant", team: "MEM", teamId: "1610612763", position: "G", ppg: 21.2, rpg: 4.8, apg: 8.1 },
  { playerId: "1628369", name: "Jayson Tatum", team: "BOS", teamId: "1610612738", position: "F", ppg: 26.9, rpg: 8.1, apg: 4.9 },
  { playerId: "203954", name: "Joel Embiid", team: "PHI", teamId: "1610612755", position: "C", ppg: 23.1, rpg: 10.5, apg: 4.2 },
  { playerId: "1630162", name: "Anthony Edwards", team: "MIN", teamId: "1610612750", position: "G", ppg: 25.6, rpg: 5.4, apg: 5.1 },
  { playerId: "1630169", name: "Tyrese Haliburton", team: "IND", teamId: "1610612754", position: "G", ppg: 18.5, rpg: 3.9, apg: 10.4 },
];

export const mockPlayerDetail: PlayerDetail = {
  playerId: "203999",
  name: "Nikola Jokic",
  team: "DEN",
  teamId: "1610612743",
  position: "C",
  jerseyNum: "15",
  ppg: 26.4,
  rpg: 12.4,
  apg: 9.0,
  seasonAverages: {
    season: "2024-25",
    gp: 45,
    ppg: 26.4,
    rpg: 12.4,
    apg: 9.0,
    fgPct: 0.563,
    threePct: 0.338,
    ftPct: 0.817,
  },
  advancedMetrics: {
    offensiveRating: 128.5,
    defensiveRating: 112.3,
    netRating: 16.2,
    trueShootingPct: 0.651,
    usagePct: 31.2,
    effectiveFgPct: 0.589,
    assistPct: 45.1,
    reboundPct: 22.8,
    pie: 0.214,
  },
};

export const mockGameLog: GameLogEntry[] = [
  { gameId: "0022400401", date: "2025-01-20", opponent: "LAL", result: "W", minutes: "36:12", points: 32, rebounds: 14, assists: 11, fgm: 13, fga: 22, threePm: 2, threePa: 4, ftm: 4, fta: 5, steals: 2, blocks: 1, turnovers: 3, plusMinus: 18 },
  { gameId: "0022400389", date: "2025-01-18", opponent: "GSW", result: "W", minutes: "34:45", points: 28, rebounds: 10, assists: 8, fgm: 11, fga: 19, threePm: 1, threePa: 3, ftm: 5, fta: 6, steals: 1, blocks: 0, turnovers: 2, plusMinus: 12 },
  { gameId: "0022400370", date: "2025-01-15", opponent: "BOS", result: "L", minutes: "38:01", points: 22, rebounds: 16, assists: 12, fgm: 9, fga: 21, threePm: 0, threePa: 2, ftm: 4, fta: 4, steals: 0, blocks: 2, turnovers: 5, plusMinus: -4 },
  { gameId: "0022400355", date: "2025-01-13", opponent: "MIA", result: "W", minutes: "33:10", points: 25, rebounds: 11, assists: 7, fgm: 10, fga: 17, threePm: 2, threePa: 5, ftm: 3, fta: 4, steals: 1, blocks: 1, turnovers: 2, plusMinus: 9 },
  { gameId: "0022400340", date: "2025-01-11", opponent: "PHX", result: "W", minutes: "35:55", points: 30, rebounds: 13, assists: 10, fgm: 12, fga: 20, threePm: 3, threePa: 6, ftm: 3, fta: 3, steals: 2, blocks: 0, turnovers: 1, plusMinus: 22 },
];

export const mockShots: ShotData[] = [
  { gameId: "0022400401", locX: 15, locY: 120, shotDistance: 12, shotType: "2PT Field Goal", shotZoneBasic: "Mid-Range", actionType: "Pullup Jump shot", made: true, period: 1 },
  { gameId: "0022400401", locX: -80, locY: 60, shotDistance: 10, shotType: "2PT Field Goal", shotZoneBasic: "In The Paint (Non-RA)", actionType: "Hook Shot", made: true, period: 1 },
  { gameId: "0022400401", locX: 5, locY: 15, shotDistance: 2, shotType: "2PT Field Goal", shotZoneBasic: "Restricted Area", actionType: "Layup Shot", made: true, period: 2 },
  { gameId: "0022400401", locX: 120, locY: 200, shotDistance: 23, shotType: "3PT Field Goal", shotZoneBasic: "Above the Break 3", actionType: "Step Back Jump shot", made: false, period: 2 },
  { gameId: "0022400401", locX: -200, locY: 30, shotDistance: 22, shotType: "3PT Field Goal", shotZoneBasic: "Left Corner 3", actionType: "Jump Shot", made: true, period: 3 },
  { gameId: "0022400401", locX: 0, locY: 5, shotDistance: 1, shotType: "2PT Field Goal", shotZoneBasic: "Restricted Area", actionType: "Dunk Shot", made: true, period: 3 },
  { gameId: "0022400401", locX: 50, locY: 150, shotDistance: 16, shotType: "2PT Field Goal", shotZoneBasic: "Mid-Range", actionType: "Fadeaway Jump Shot", made: false, period: 4 },
  { gameId: "0022400401", locX: -150, locY: 230, shotDistance: 27, shotType: "3PT Field Goal", shotZoneBasic: "Above the Break 3", actionType: "Pull-Up Jump shot", made: true, period: 4 },
  { gameId: "0022400401", locX: 220, locY: 30, shotDistance: 23, shotType: "3PT Field Goal", shotZoneBasic: "Right Corner 3", actionType: "Catch and Shoot", made: false, period: 1 },
  { gameId: "0022400401", locX: -30, locY: 90, shotDistance: 10, shotType: "2PT Field Goal", shotZoneBasic: "In The Paint (Non-RA)", actionType: "Floating Jump shot", made: true, period: 2 },
];

export const mockTeams: TeamSummary[] = [
  { teamId: "1610612738", name: "Boston Celtics", abbreviation: "BOS", city: "Boston", wins: 35, losses: 10, offRating: 121.3, defRating: 108.5, netRating: 12.8 },
  { teamId: "1610612760", name: "Oklahoma City Thunder", abbreviation: "OKC", city: "Oklahoma City", wins: 34, losses: 11, offRating: 119.8, defRating: 107.2, netRating: 12.6 },
  { teamId: "1610612743", name: "Denver Nuggets", abbreviation: "DEN", city: "Denver", wins: 30, losses: 15, offRating: 118.5, defRating: 112.1, netRating: 6.4 },
  { teamId: "1610612749", name: "Milwaukee Bucks", abbreviation: "MIL", city: "Milwaukee", wins: 28, losses: 17, offRating: 117.9, defRating: 113.4, netRating: 4.5 },
  { teamId: "1610612755", name: "Philadelphia 76ers", abbreviation: "PHI", city: "Philadelphia", wins: 22, losses: 23, offRating: 113.1, defRating: 112.8, netRating: 0.3 },
  { teamId: "1610612742", name: "Dallas Mavericks", abbreviation: "DAL", city: "Dallas", wins: 27, losses: 18, offRating: 116.2, defRating: 112.5, netRating: 3.7 },
  { teamId: "1610612756", name: "Phoenix Suns", abbreviation: "PHX", city: "Phoenix", wins: 26, losses: 19, offRating: 115.8, defRating: 113.1, netRating: 2.7 },
  { teamId: "1610612750", name: "Minnesota Timberwolves", abbreviation: "MIN", city: "Minnesota", wins: 29, losses: 16, offRating: 112.4, defRating: 106.8, netRating: 5.6 },
  { teamId: "1610612754", name: "Indiana Pacers", abbreviation: "IND", city: "Indiana", wins: 27, losses: 18, offRating: 120.1, defRating: 115.3, netRating: 4.8 },
  { teamId: "1610612763", name: "Memphis Grizzlies", abbreviation: "MEM", city: "Memphis", wins: 25, losses: 20, offRating: 114.5, defRating: 112.0, netRating: 2.5 },
];

export const mockTeamDetail: TeamDetail = {
  teamId: "1610612743",
  name: "Denver Nuggets",
  abbreviation: "DEN",
  city: "Denver",
  wins: 30,
  losses: 15,
  offRating: 118.5,
  defRating: 112.1,
  netRating: 6.4,
  season: "2024-25",
  record: { wins: 30, losses: 15 },
  stats: { ppg: 115.2, oppPpg: 109.8, offRating: 118.5, defRating: 112.1, pace: 99.2, fgPct: 0.482, threePct: 0.372, ftPct: 0.801 },
  roster: [
    { playerId: "203999", name: "Nikola Jokic", position: "C", jerseyNum: "15" },
    { playerId: "1628370", name: "Jamal Murray", position: "G", jerseyNum: "27" },
    { playerId: "203914", name: "Michael Porter Jr.", position: "F", jerseyNum: "1" },
    { playerId: "1629008", name: "Aaron Gordon", position: "F", jerseyNum: "50" },
    { playerId: "1629611", name: "Christian Braun", position: "G", jerseyNum: "0" },
  ],
  recentGames: [
    { gameId: "0022400401", date: "2025-01-20", opponent: "LAL", result: "W", score: "118-105" },
    { gameId: "0022400389", date: "2025-01-18", opponent: "GSW", result: "W", score: "124-110" },
    { gameId: "0022400370", date: "2025-01-15", opponent: "BOS", result: "L", score: "105-112" },
    { gameId: "0022400355", date: "2025-01-13", opponent: "MIA", result: "W", score: "110-98" },
    { gameId: "0022400340", date: "2025-01-11", opponent: "PHX", result: "W", score: "132-115" },
  ],
};

export const mockLeaderboard: LeaderboardEntry[] = mockPlayers
  .sort((a, b) => b.ppg - a.ppg)
  .map((p, i) => ({
    rank: i + 1,
    playerId: p.playerId,
    name: p.name,
    team: p.team,
    value: p.ppg,
    gamesPlayed: 45 - i * 2,
  }));

export const mockComparison: ComparisonPlayer[] = [
  { playerId: "203999", name: "Nikola Jokic", team: "DEN", stats: { ppg: 26.4, rpg: 12.4, apg: 9.0, fgPct: 56.3, tsPct: 65.1 } },
  { playerId: "203954", name: "Joel Embiid", team: "PHI", stats: { ppg: 23.1, rpg: 10.5, apg: 4.2, fgPct: 51.2, tsPct: 61.2 } },
];
