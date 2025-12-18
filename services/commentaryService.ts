const GOAL_LINES = [
  "¡GOLAZO! La grada explota de alegría.",
  "¡La clavó en el ángulo, imposible para el arquero!",
  "¡Definición letal, la red todavía vibra!",
  "¡Celebración total, el marcador se mueve otra vez!"
];

const ATTACK_LINES = [
  "¡Conducción eléctrica, se huele el peligro!",
  "¡Verticalidad total, quieren romper líneas ya!",
  "¡Se animan a encarar, el estadio ruge!",
  "¡Qué gambeta, deja rivales por el camino!"
];

const DEFENSE_LINES = [
  "¡Barrida salvadora, qué timing!",
  "¡Defensa férrea, no pasan ni las ideas!",
  "¡Cierre impecable, apagan el fuego a tiempo!",
  "¡Orden táctico, bloque compacto atrás!"
];

const MIDFIELD_LINES = [
  "¡Duelo en la sala de máquinas, nadie cede!",
  "¡Se cocina la jugada desde el medio!",
  "¡Templanza y pausa, mueven el balón con criterio!",
  "¡Cambio de orientación exquisito, se abre el campo!"
];

const DEFAULT_LINES = [
  "¡El ritmo es frenético, esto no para!",
  "¡La hinchada empuja, se vive a tope!",
  "¡Cada pase cuenta, partido de detalles!",
  "¡Intensidad máxima en cada metro del césped!"
];

const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const detectCategory = (description: string) => {
  const text = description.toLowerCase();
  if (text.includes('gol') || text.includes('celebración')) return GOAL_LINES;
  if (text.includes('tiro') || text.includes('disparo') || text.includes('remate')) return ATTACK_LINES;
  if (text.includes('pase') || text.includes('conduce') || text.includes('ataque')) return ATTACK_LINES;
  if (text.includes('robo') || text.includes('bloqueo') || text.includes('defensa') || text.includes('despeje')) return DEFENSE_LINES;
  if (text.includes('medio') || text.includes('centro') || text.includes('posesión')) return MIDFIELD_LINES;
  return DEFAULT_LINES;
};

export const getMatchCommentary = async (eventDescription: string) => {
  const pool = detectCategory(eventDescription);
  const line = pickRandom(pool);
  return `${line}`;
};

