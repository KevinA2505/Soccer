
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

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

const evaluatePassSafety = (start: Position, target: Position, opponents: Player[]) => {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const dir = { x: dx / dist, y: dy / dist };

  let laneRisk = 0;
  opponents.forEach(opp => {
    const toOpp = { x: opp.position.x - start.x, y: opp.position.y - start.y };
    const projection = toOpp.x * dir.x + toOpp.y * dir.y;
    if (projection < 0 || projection > dist) return;

    const closestPoint = { x: start.x + dir.x * projection, y: start.y + dir.y * projection };
    const lateralDist = Math.sqrt((opp.position.x - closestPoint.x) ** 2 + (opp.position.y - closestPoint.y) ** 2);
    const interceptThreshold = Math.max(3, 1.8 + dist * 0.04);

    if (lateralDist < interceptThreshold) {
      laneRisk += (interceptThreshold - lateralDist) * 12 + opp.stats.defense * 0.2;
    }
  });

  return { isSafe: laneRisk < 22, laneRisk };
};

const shotTargetsForSide = (goalX: number, playerY: number): Position[] => {
  const farPostOffset = playerY < 40 ? 7 : -7;
  const nearPostOffset = playerY < 40 ? -4 : 4;
  const centerLean = playerY < 40 ? 2.5 : -2.5;
  return [
    { x: goalX, y: clamp(40 + farPostOffset, 30, 50) },
    { x: goalX, y: clamp(40 + nearPostOffset, 32, 48) },
    { x: goalX, y: clamp(40 + centerLean, 33, 47) }
  ];
};

export const getAIDecision = (aiPlayer: Player, players: Player[], ball: Ball) => {
  const opponentGoal = { x: aiPlayer.side === TeamSide.HOME ? 120 : 0, y: 40 };
  const ownGoal = { x: aiPlayer.side === TeamSide.HOME ? 0 : 120, y: 40 };
  const forwardDir = aiPlayer.side === TeamSide.HOME ? 1 : -1;
  const distToGoal = Math.sqrt((aiPlayer.position.x - opponentGoal.x)**2 + (aiPlayer.position.y - opponentGoal.y)**2);
  const distToOwnGoal = Math.sqrt((aiPlayer.position.x - ownGoal.x)**2 + (aiPlayer.position.y - ownGoal.y)**2);
  const opponents = players.filter(p => p.side !== aiPlayer.side);
  const closestOppDist = Math.min(...opponents.map(o => Math.sqrt((o.position.x - aiPlayer.position.x)**2 + (o.position.y - aiPlayer.position.y)**2)), 50);

  if ((aiPlayer.role === PlayerRole.DEF || aiPlayer.role === PlayerRole.GK) && distToOwnGoal < 32 && closestOppDist < 8) {
    const clearanceTarget = { 
      x: clamp(aiPlayer.position.x + forwardDir * 24, 4, 116), 
      y: clamp(aiPlayer.position.y + (aiPlayer.position.y < 40 ? -14 : 14), 4, 76) 
    };
    return { type: 'pass', target: clearanceTarget, power: 88 };
  }

  if (distToGoal < 35) {
    const shotCandidates = shotTargetsForSide(opponentGoal.x, aiPlayer.position.y).map(target => ({
      target,
      prob: calculateProbability('shoot', aiPlayer, target, players, ball, 92)
    }));
    const bestShot = shotCandidates.sort((a, b) => b.prob - a.prob)[0];
    const roleShotBonus = aiPlayer.role === PlayerRole.FWD ? -6 : aiPlayer.role === PlayerRole.MID ? 0 : 8;
    if (bestShot && bestShot.prob > 22 + roleShotBonus) {
      return { type: 'shoot', target: bestShot.target, power: 88 + Math.random() * 8 };
    }
  }

  const teammates = players.filter(p => p.side === aiPlayer.side && p.id !== aiPlayer.id);
  const passOptions = teammates.map(t => {
    const dist = Math.sqrt((t.position.x - aiPlayer.position.x)**2 + (t.position.y - aiPlayer.position.y)**2);
    const optimalPower = Math.min(100, dist * 1.3 + 15);
    const prob = calculateProbability('pass', aiPlayer, t.position, players, ball, optimalPower);
    const { isSafe, laneRisk } = evaluatePassSafety(aiPlayer.position, t.position, opponents);
    const progression = (t.position.x - aiPlayer.position.x) * forwardDir;
    const switchValue = Math.abs(t.position.y - aiPlayer.position.y);
    const wallOption = dist < 18 && Math.abs(t.position.y - aiPlayer.position.y) < 12;

    let roleScore = 0;
    switch (aiPlayer.role) {
      case PlayerRole.DEF:
      case PlayerRole.GK:
        roleScore = prob * 0.9 + (isSafe ? 18 : -8) + Math.min(-progression * 0.8, 12);
        break;
      case PlayerRole.MID:
        roleScore = prob * 0.65 + progression * 4.5 + switchValue * 0.7 + (isSafe ? 10 : 0);
        break;
      case PlayerRole.FWD:
        roleScore = prob * 0.55 + progression * 3.6 + (wallOption ? 14 : 0) + (distToGoal < 42 ? 6 : 0);
        break;
      default:
        roleScore = prob * 0.7 + progression * 2.4;
    }

    const safetyAdjustment = isSafe ? 8 : -laneRisk * 0.4;
    const score = roleScore + safetyAdjustment;
    return { t, score, prob, power: optimalPower, isSafe };
  });

  const bestPass = passOptions
    .filter(o => (o.prob > 32 && o.isSafe) || o.score > 25)
    .sort((a, b) => b.score - a.score)[0];
  if (bestPass && bestPass.score > 18) return { type: 'pass', target: bestPass.t.position, power: bestPass.power };

  let driftY = aiPlayer.position.y + (Math.random() > 0.5 ? 10 : -10);
  const blocker = opponents.find(o => Math.sqrt((o.position.x - aiPlayer.position.x)**2 + (o.position.y - aiPlayer.position.y)**2) < 8);
  if (blocker) driftY = blocker.position.y > aiPlayer.position.y ? aiPlayer.position.y - 15 : aiPlayer.position.y + 15;

  return { 
    type: 'dribble', 
    target: { x: clamp(aiPlayer.position.x + (12 * forwardDir), 2, 118), y: Math.max(5, Math.min(75, driftY)) }, 
    power: 45 
  };
};
