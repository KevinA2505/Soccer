
export enum TeamSide {
  HOME = 'HOME',
  AWAY = 'AWAY'
}

export enum PlayerRole {
  GK = 'GK',
  DEF = 'DEF',
  MID = 'MID',
  FWD = 'FWD'
}

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  side: TeamSide;
  role: PlayerRole;
  position: Position;
  anchor: Position; 
  stamina: number; // 0 to 100
  stats: {
    speed: number;
    passing: number;
    shooting: number;
    dribbling: number;
    defense: number;
  };
  hasBall: boolean;
  actionCooldown: number; 
  dashCooldown: number; // Cooldown for goalkeeper dash
}

export interface Ball {
  position: Position;
  velocity: Position;
  ownerId: string | null;
}

export enum MatchPhase {
  COIN_TOSS = 'COIN_TOSS',
  LIVE = 'LIVE',
  GOAL_CELEBRATION = 'GOAL_CELEBRATION'
}

export type TeamStrategy = 'DEFENSIVE' | 'BALANCED' | 'ATTACKING';

export interface MatchState {
  score: { home: number; away: number };
  phase: MatchPhase;
  ball: Ball;
  players: Player[];
  timer: number;
  lastActionSummary: string;
  possessingSide: TeamSide | null;
  homeStrategy: TeamStrategy;
  isGlobalPressing: boolean;
  celebrationTeam: TeamSide | null;
}
