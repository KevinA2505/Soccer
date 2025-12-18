
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MatchState, MatchPhase, TeamSide, PlayerRole,
  Player, Position, Ball, TeamStrategy
} from './types';
import {
  PITCH_WIDTH, PITCH_HEIGHT,
  HOME_FORMATION_BASE, AWAY_FORMATION_BASE,
  CENTER_POINT, PLAYER_RADIUS
} from './constants';
import Pitch from './components/Pitch';
import { calculateProbability, getAIDecision } from './engine/MatchLogic';
import { getMatchCommentary } from './services/commentaryService';

const createPlayers = (startingSide: TeamSide, isKickoff: boolean = false): Player[] => {
  const players: Player[] = [];
  const setup = (formation: Record<string, Position>, side: TeamSide) => {
    Object.entries(formation).forEach(([key, pos], idx) => {
      let finalPos = { ...pos };
      // Ajuste de formación para saque inicial
      if (isKickoff) {
        if (side === TeamSide.HOME) finalPos.x = Math.min(finalPos.x, 58);
        else finalPos.x = Math.max(finalPos.x, 62);
      }
      
      players.push({
        id: `${side.toLowerCase()}_${idx}`,
        name: key,
        side,
        role: key.includes('GK') ? PlayerRole.GK : (key.includes('B') && !key.includes('M')) ? PlayerRole.DEF : key.includes('M') ? PlayerRole.MID : PlayerRole.FWD,
        position: finalPos,
        anchor: { ...pos },
        stamina: 100,
        stats: { 
          speed: 70 + Math.random()*20, 
          passing: 70 + Math.random()*25, 
          shooting: 70 + Math.random()*25, 
          dribbling: 70 + Math.random()*25, 
          defense: 70 + Math.random()*25 
        },
        hasBall: false,
        actionCooldown: 0,
        dashCooldown: 0
      });
    });
  };
  setup(HOME_FORMATION_BASE, TeamSide.HOME);
  setup(AWAY_FORMATION_BASE, TeamSide.AWAY);
  return players;
};

const App: React.FC = () => {
  const [match, setMatch] = useState<MatchState>({
    score: { home: 0, away: 0 },
    phase: MatchPhase.COIN_TOSS,
    ball: { position: { ...CENTER_POINT }, velocity: { x: 0, y: 0 }, ownerId: null },
    players: [],
    timer: 0,
    lastActionSummary: "Sorteo inicial...",
    possessingSide: null,
    homeStrategy: 'BALANCED',
    isGlobalPressing: false,
    celebrationTeam: null
  });

  const [commentary, setCommentary] = useState("¡Bienvenidos al Tactical Soccer Pro!");
  const [chargingPower, setChargingPower] = useState(0);
  const [activeGadget, setActiveGadget] = useState<string | null>(null);
  const chargeRef = useRef<number>(0);
  const chargeInterval = useRef<any>(null);
  const pendingAction = useRef<{pos: Position, player?: Player} | null>(null);
  const lastAiCallRef = useRef<number>(0);
  const AI_COOLDOWN = 12000;

  const updateCommentary = useCallback(async (eventDescription: string, forceAi = false) => {
    const now = Date.now();
    const isPriority = forceAi || eventDescription.toLowerCase().includes('gol');
    if (isPriority || (now - lastAiCallRef.current > AI_COOLDOWN)) {
      lastAiCallRef.current = now;
      const aiText = await getMatchCommentary(eventDescription);
      setCommentary(aiText);
    }
    setMatch(prev => ({ ...prev, lastActionSummary: eventDescription }));
  }, []);

  const resetForKickoff = useCallback((sideToKick: TeamSide) => {
    const players = createPlayers(sideToKick, true);
    // El delantero centro del equipo que saca recibe el balón
    const striker = players.find(p => p.side === sideToKick && p.role === PlayerRole.FWD);
    if (striker) {
      striker.position = { x: 60, y: 40 };
      striker.hasBall = true;
    }

    setMatch(prev => ({
      ...prev,
      players,
      phase: MatchPhase.LIVE,
      ball: { position: { ...CENTER_POINT }, velocity: { x: 0, y: 0 }, ownerId: striker?.id || null },
      celebrationTeam: null,
      lastActionSummary: `Saque de centro: ${sideToKick}`
    }));
    updateCommentary(`¡Saca de centro el equipo ${sideToKick}!`, true);
  }, [updateCommentary]);

  // Manejador de la fase de celebración y reinicio
  useEffect(() => {
    if (match.phase === MatchPhase.GOAL_CELEBRATION) {
      const timer = setTimeout(() => {
        // Reiniciamos con saque para el equipo que recibió el gol
        const concedingSide = match.celebrationTeam === TeamSide.HOME ? TeamSide.AWAY : TeamSide.HOME;
        resetForKickoff(concedingSide);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [match.phase, match.celebrationTeam, resetForKickoff]);

  const executeAction = useCallback((type: 'pass' | 'shoot' | 'dribble', target: Position, power: number, actorId?: string) => {
    setMatch(prev => {
      const actor = actorId ? prev.players.find(p => p.id === actorId) : prev.players.find(p => p.hasBall);
      if (!actor || !actor.hasBall || actor.actionCooldown > 0) return prev;
      
      const prob = calculateProbability(type, actor, target, prev.players, prev.ball, power);
      const success = Math.random() * 100 < (prob + 5);
      
      const dx = target.x - actor.position.x;
      const dy = target.y - actor.position.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      
      let nextBallVel = { x: 0, y: 0 };
      const baseForce = (power / 100) * (type === 'shoot' ? 17 : 12) + 2.8;

      if (success) {
        nextBallVel = { x: (dx/dist)*baseForce, y: (dy/dist)*baseForce };
      } else {
        const dev = (100 - prob) * 0.003;
        const angle = Math.atan2(dy, dx) + (Math.random()-0.5)*dev;
        nextBallVel = { x: Math.cos(angle)*baseForce*0.8, y: Math.sin(angle)*baseForce*0.8 };
      }

      const updatedPlayers = prev.players.map(p => 
        p.id === actor.id ? { ...p, stamina: Math.max(0, p.stamina - (power/14)), actionCooldown: 25, hasBall: false } : p
      );

      return { 
        ...prev, 
        players: updatedPlayers, 
        ball: { ...prev.ball, velocity: nextBallVel, ownerId: null },
        lastActionSummary: `${actor.name} ${type}` 
      };
    });
  }, []);

  useEffect(() => {
    if (match.phase !== MatchPhase.LIVE) return;
    const interval = setInterval(() => {
      setMatch(prev => {
        const ballPos = prev.ball.position;
        const owner = prev.players.find(p => p.hasBall);

        // IA RIVAL
        if (owner && owner.side === TeamSide.AWAY && owner.actionCooldown === 0) {
           const dec = getAIDecision(owner, prev.players, prev.ball);
           if (dec) setTimeout(() => executeAction(dec.type as any, dec.target, dec.power || 50, owner.id), 0);
        }

        // MOVIIMIENTO TÁCTICO MEJORADO
        const nextPlayers = prev.players.map(p => {
          let target = { ...p.anchor };
          const isAttacking = owner?.side === p.side;
          const isChaser = !owner && (
            p.id === [...prev.players].sort((a,b) => 
              Math.sqrt((a.position.x-ballPos.x)**2 + (a.position.y-ballPos.y)**2) - 
              Math.sqrt((b.position.x-ballPos.x)**2 + (b.position.y-ballPos.y)**2))[0].id
          );

          if (p.hasBall) return p;

          // 1. Lógica de Portero (Achique)
          if (p.role === PlayerRole.GK) {
            const goalX = p.side === TeamSide.HOME ? 0 : 120;
            const distBallGoal = Math.abs(ballPos.x - goalX);
            if (distBallGoal < 30) {
              target.x = goalX + (p.side === TeamSide.HOME ? 6 : -6);
              target.y = ballPos.y * 0.3 + 40 * 0.7; // Se posiciona ligeramente hacia el balón
            }
          } 
          // 2. Lógica de Persecución
          else if (isChaser) {
            target = { ...ballPos };
          } 
          // 3. Lógica Defensiva (Marcaje)
          else if (!isAttacking) {
            const nearestOpp = prev.players
              .filter(o => o.side !== p.side)
              .sort((a,b) => Math.sqrt((a.position.x-p.position.x)**2 + (a.position.y-p.position.y)**2) - 
                            Math.sqrt((b.position.x-p.position.x)**2 + (b.position.y-p.position.y)**2))[0];
            if (nearestOpp) {
              // Se sitúa entre el rival y su portería
              const goalX = p.side === TeamSide.HOME ? 0 : 120;
              target.x = nearestOpp.position.x * 0.7 + goalX * 0.3;
              target.y = nearestOpp.position.y * 0.7 + 40 * 0.3;
            }
          } 
          // 4. Lógica Ofensiva (Desmarques)
          else {
            const forwardDir = p.side === TeamSide.HOME ? 1 : -1;
            target.x = p.anchor.x + (ballPos.x - 60) * 0.5 + (forwardDir * 15);
            target.y = p.anchor.y + (ballPos.y - 40) * 0.3;
          }

          let speed = (p.stats.speed / 100) * (isChaser ? 1.2 : 0.9);
          const dx = target.x - p.position.x, dy = target.y - p.position.y;
          const d = Math.sqrt(dx*dx + dy*dy) || 1;

          return { 
            ...p, 
            position: { 
              x: Math.max(2, Math.min(118, p.position.x + (dx/d)*speed)), 
              y: Math.max(2, Math.min(78, p.position.y + (dy/d)*speed)) 
            },
            actionCooldown: Math.max(0, p.actionCooldown - 1),
            stamina: Math.max(10, p.stamina - (isChaser ? 0.05 : 0.01))
          };
        });

        // FÍSICA DE BALÓN
        let nbPos = { x: prev.ball.position.x + prev.ball.velocity.x, y: prev.ball.position.y + prev.ball.velocity.y };
        let nbVel = { x: prev.ball.velocity.x * 0.97, y: prev.ball.velocity.y * 0.97 };

        // Detección de Gol
        if (nbPos.x < 0 || nbPos.x > 120) {
          if (nbPos.y >= 32.5 && nbPos.y <= 47.5) {
            const scoringTeam = nbPos.x > 120 ? TeamSide.HOME : TeamSide.AWAY;
            setTimeout(() => updateCommentary(`¡GOOOOOL de ${scoringTeam}!`, true), 100);
            return { 
              ...prev, 
              score: scoringTeam === TeamSide.HOME ? { ...prev.score, home: prev.score.home + 1 } : { ...prev.score, away: prev.score.away + 1 },
              phase: MatchPhase.GOAL_CELEBRATION,
              celebrationTeam: scoringTeam,
              ball: { ...prev.ball, velocity: { x: 0, y: 0 } }
            };
          }
          nbVel.x *= -0.5; nbPos.x = nbPos.x < 0 ? 0.1 : 119.9;
        }
        if (nbPos.y < 0 || nbPos.y > 80) { nbVel.y *= -0.5; nbPos.y = nbPos.y < 0 ? 0.1 : 79.9; }

        let nOwnerId = prev.ball.ownerId;
        if (!nOwnerId) {
          const nearest = nextPlayers.find(p => Math.sqrt((p.position.x-nbPos.x)**2 + (p.position.y-nbPos.y)**2) < 2.5 && p.actionCooldown === 0);
          if (nearest) nOwnerId = nearest.id;
        } else {
          const o = nextPlayers.find(p => p.id === nOwnerId);
          if (o) { nbPos = { ...o.position }; nbVel = { x: 0, y: 0 }; }
        }

        return { 
          ...prev, 
          players: nextPlayers.map(p => ({ ...p, hasBall: p.id === nOwnerId })), 
          ball: { ...prev.ball, position: nbPos, velocity: nbVel, ownerId: nOwnerId }, 
          timer: prev.timer + 0.04 
        };
      });
    }, 40);
    return () => clearInterval(interval);
  }, [match.phase, executeAction, updateCommentary]);

  return (
    <div className="flex flex-col h-screen bg-[#050a05] text-white font-sans overflow-hidden select-none"
         onMouseUp={() => { 
           if (chargeInterval.current) { clearInterval(chargeInterval.current); chargeInterval.current = null; } 
           if (pendingAction.current) {
             const { pos, player } = pendingAction.current;
             const pwr = chargeRef.current;
             const owner = match.players.find(p => p.hasBall);
             if (owner) {
                if (player && player.side === TeamSide.HOME && player.id !== owner.id) executeAction('pass', player.position, pwr);
                else executeAction(pos.x > 98 ? 'shoot' : 'dribble', pos, pwr);
             }
             pendingAction.current = null; setChargingPower(0);
           }
         }}>
      
      <div className="bg-gradient-to-b from-black to-transparent p-6 flex justify-between items-start z-10">
         <div className="flex gap-4 items-center bg-black/80 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow-2xl">
            <div className="text-center px-4">
               <div className="text-[10px] font-bold text-blue-500 uppercase">LOCAL</div>
               <div className="text-5xl font-black">{match.score.home}</div>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center px-4">
               <div className="text-[10px] font-bold text-red-500 uppercase">VISITA</div>
               <div className="text-5xl font-black">{match.score.away}</div>
            </div>
            <div className="bg-red-600 px-3 py-1 rounded text-[10px] font-black animate-pulse self-start ml-2">LIVE</div>
         </div>
         
         <div className="flex flex-col items-center">
            <div className="bg-white/10 px-8 py-2 rounded-full backdrop-blur-lg border border-white/20">
               <span className="text-3xl font-mono font-black">
                 {Math.floor(match.timer/60).toString().padStart(2,'0')}:{(Math.floor(match.timer)%60).toString().padStart(2,'0')}
               </span>
            </div>
         </div>

         <div className="max-w-[300px] text-right">
            <p className="text-emerald-400 font-bold italic text-lg leading-tight uppercase tracking-tighter">"{commentary}"</p>
            <p className="text-[10px] text-white/30 mt-2 uppercase tracking-widest">{match.lastActionSummary}</p>
         </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center p-4">
         {match.phase === MatchPhase.COIN_TOSS && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl">
               <div className="text-center">
                  <h1 className="text-8xl font-black italic mb-12 tracking-tighter text-white">TACTICAL SOCCER <span className="text-blue-600">PRO</span></h1>
                  <button onClick={() => resetForKickoff(TeamSide.HOME)} className="px-20 py-8 bg-blue-600 rounded-full font-black text-2xl hover:scale-105 transition-all shadow-[0_0_50px_rgba(37,99,235,0.5)]">EMPEZAR PARTIDO</button>
               </div>
            </div>
         )}

         <Pitch matchState={match} 
                selectedAction={chargingPower}
                onPlayerClick={(p) => { if (match.players.find(o => o.hasBall)?.side === TeamSide.HOME) { pendingAction.current = { pos: p.position, player: p }; chargeRef.current = 0; chargeInterval.current = setInterval(() => { chargeRef.current = Math.min(100, chargeRef.current + 8); setChargingPower(chargeRef.current); }, 40); } }}
                onPitchClick={(pos) => { if (match.players.find(o => o.hasBall)?.side === TeamSide.HOME) { pendingAction.current = { pos }; chargeRef.current = 0; chargeInterval.current = setInterval(() => { chargeRef.current = Math.min(100, chargeRef.current + 8); setChargingPower(chargeRef.current); }, 40); } }} />

         {chargingPower > 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-80 h-4 bg-black/80 rounded-full border border-white/20 overflow-hidden shadow-2xl">
               <div className="h-full bg-gradient-to-r from-blue-500 via-emerald-400 to-red-500" style={{ width: `${chargingPower}%` }} />
            </div>
         )}
      </div>

      <div className="p-6 text-center text-[10px] font-bold text-white/20 uppercase tracking-[0.5em]">
          Tactical Engine v2.6 // Kickoff Update
      </div>
    </div>
  );
};

export default App;
