
import { Position } from './types';

export const PITCH_WIDTH = 120;
export const PITCH_HEIGHT = 80;
export const SCALE = 8;
export const PLAYER_RADIUS = 1.6; // Ligeramente más grandes para mejor visibilidad
export const BALL_RADIUS = 0.8;
export const GOAL_WIDTH = 15;

// Colores de la marca
export const COLORS = {
  HOME: '#2563eb',
  AWAY: '#dc2626',
  BALL: '#ffffff',
  PITCH: '#1a3318',
  PITCH_STRIPE: '#1e3d1b',
  UI_ACCENT: '#fbbf24'
};

// Formaciones 4-4-2 Optimizadas
export const HOME_FORMATION_BASE: Record<string, Position> = {
  'GK': { x: 5, y: 40 },
  'LB': { x: 25, y: 15 },
  'CB1': { x: 22, y: 32 },
  'CB2': { x: 22, y: 48 },
  'RB': { x: 25, y: 65 },
  'LM': { x: 52, y: 15 },
  'CM1': { x: 48, y: 32 },
  'CM2': { x: 48, y: 48 },
  'RM': { x: 52, y: 65 },
  'FW1': { x: 58, y: 35 },
  'FW2': { x: 58, y: 45 },
};

export const AWAY_FORMATION_BASE: Record<string, Position> = {
  'GK': { x: 115, y: 40 },
  'LB': { x: 95, y: 65 },
  'CB1': { x: 98, y: 48 },
  'CB2': { x: 98, y: 32 },
  'RB': { x: 95, y: 15 },
  'LM': { x: 68, y: 65 },
  'CM1': { x: 72, y: 48 },
  'CM2': { x: 72, y: 32 },
  'RM': { x: 68, y: 15 },
  'FW1': { x: 62, y: 45 },
  'FW2': { x: 62, y: 35 },
};

export const CENTER_POINT = { x: 60, y: 40 };
