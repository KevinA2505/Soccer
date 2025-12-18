
import { Player, Ball, Position, PlayerRole, TeamSide } from '../types';

export const calculateProbability = (
  actionType: 'pass' | 'shoot' | 'dribble' | 'tackle',
  actor: Player,
  target: Position,
  allPlayers: Player[],
  ball: Ball,
  power: number = 50
): number => {
  const dx = target.x - actor.position.x;
  const dy = target.y - actor.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const staminaFactor = 0.5 + (actor.stamina / 100) * 0.5;
  
  const opponents = allPlayers.filter(p => p.side !== actor.side);
  let pressurePenalty = 0;
  opponents.forEach(opp => {
    const oppDist = Math.sqrt((opp.position.x - actor.position.x)**2 + (opp.position.y - actor.position.y)**2);
    if (oppDist < 5) pressurePenalty += (5 - oppDist) * 12;
  });

  if (actionType === 'tackle') {
    const victim = allPlayers.find(p => p.hasBall);
    if (!victim) return 0;
    const baseTackle = actor.stats.defense * 1.5;
    const victimDefense = victim.stats.dribbling * 1.2;
    return Math.max(10, Math.min(85, (baseTackle - victimDefense + 50) * staminaFactor));
  }

  const idealPower = actionType === 'pass' ? Math.min(90, dist * 1.4 + 12) : 88;
  const powerDiff = Math.abs(power - idealPower);
  const powerPenalty = powerDiff * 0.7;

  if (actionType === 'pass') {
    let baseProb = actor.stats.passing * 2.1 - (dist * 0.45) - pressurePenalty - powerPenalty;
    opponents.forEach(def => {
      const distToPath = getPointToLineDistance(actor.position, target, def.position);
      if (distToPath < 3.5) baseProb -= (def.stats.defense * 0.75);
    });
    return Math.max(1, Math.min(99, baseProb * staminaFactor));
  } 
  
  if (actionType === 'shoot') {
    const goalX = actor.side === TeamSide.HOME ? 120 : 0;
    const distToGoal = Math.sqrt((actor.position.x - goalX)**2 + (actor.position.y - 40)**2);
    const anglePenalty = Math.abs(actor.position.y - 40) * 3;
    let baseProb = actor.stats.shooting * 2.4 - (distToGoal * 1.6) - anglePenalty - pressurePenalty - powerPenalty * 0.4;
    return Math.max(1, Math.min(96, baseProb * staminaFactor));
  }

  return Math.max(5, Math.min(99, (actor.stats.dribbling * 2.6 - pressurePenalty * 3.5) * staminaFactor));
};

export const getPointToLineDistance = (start: Position, end: Position, pt: Position) => {
  const L2 = (end.x - start.x)**2 + (end.y - start.y)**2;
  if (L2 === 0) return Math.sqrt((pt.x - start.x)**2 + (pt.y - start.y)**2);
  let t = ((pt.x - start.x) * (end.x - start.x) + (pt.y - start.y) * (end.y - start.y)) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((pt.x - (start.x + t * (end.x - start.x)))**2 + (pt.y - (start.y + t * (end.y - start.y)))**2);
};

export const getAIDecision = (aiPlayer: Player, players: Player[], ball: Ball) => {
  const goalPos = { x: 0, y: 40 };
  const distToGoal = Math.sqrt((aiPlayer.position.x - goalPos.x)**2 + (aiPlayer.position.y - goalPos.y)**2);

  if (distToGoal < 35) {
    const corners = [32, 48];
    const targetY = corners[Math.floor(Math.random() * corners.length)];
    const shootProb = calculateProbability('shoot', aiPlayer, { x: 0, y: targetY }, players, ball, 90);
    if (shootProb > 25) return { type: 'shoot', target: { x: 0, y: targetY }, power: 88 + Math.random() * 8 };
  }

  const teammates = players.filter(p => p.side === aiPlayer.side && p.id !== aiPlayer.id);
  const passOptions = teammates.map(t => {
    const dist = Math.sqrt((t.position.x - aiPlayer.position.x)**2 + (t.position.y - aiPlayer.position.y)**2);
    const optimalPower = Math.min(100, dist * 1.3 + 15);
    const prob = calculateProbability('pass', aiPlayer, t.position, players, ball, optimalPower);
    const progression = aiPlayer.position.x - t.position.x; 
    const score = (prob * 0.7) + (progression * 3.0);
    return { t, score, prob, power: optimalPower };
  });

  const bestPass = passOptions.filter(o => o.prob > 40).sort((a, b) => b.score - a.score)[0];
  if (bestPass && bestPass.score > 20) return { type: 'pass', target: bestPass.t.position, power: bestPass.power };

  const opponents = players.filter(p => p.side !== aiPlayer.side);
  let driftY = aiPlayer.position.y + (Math.random() > 0.5 ? 10 : -10);
  const blocker = opponents.find(o => Math.sqrt((o.position.x - aiPlayer.position.x)**2 + (o.position.y - aiPlayer.position.y)**2) < 8);
  if (blocker) driftY = blocker.position.y > aiPlayer.position.y ? aiPlayer.position.y - 15 : aiPlayer.position.y + 15;

  return { 
    type: 'dribble', 
    target: { x: Math.max(10, aiPlayer.position.x - 12), y: Math.max(5, Math.min(75, driftY)) }, 
    power: 45 
  };
};
