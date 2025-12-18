
import React, { useRef, useEffect, useState } from 'react';
import { MatchState, TeamSide, Position, MatchPhase, PlayerRole } from '../types';
import { PITCH_WIDTH, PITCH_HEIGHT, PLAYER_RADIUS, BALL_RADIUS, GOAL_WIDTH } from '../constants';

interface PitchProps {
  matchState: MatchState;
  onPlayerClick?: (player: any) => void;
  onPitchClick?: (pos: Position) => void;
  selectedAction: number;
}

const Pitch: React.FC<PitchProps> = ({ matchState, onPlayerClick, onPitchClick, selectedAction }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPos, setHoveredPos] = useState<Position | null>(null);
  const ballHistory = useRef<Position[]>([]);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (matchState.phase === MatchPhase.GOAL_CELEBRATION) {
      setShake(15);
      const interval = setInterval(() => setShake(s => Math.max(0, s * 0.8)), 50);
      return () => clearInterval(interval);
    }
  }, [matchState.phase]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    const containerWidth = canvasRef.current?.parentElement?.clientWidth || 800;
    const S = containerWidth / PITCH_WIDTH;
    const W = PITCH_WIDTH * S;
    const H = PITCH_HEIGHT * S;

    if (canvasRef.current && (canvasRef.current.width !== W || canvasRef.current.height !== H)) {
      canvasRef.current.width = W;
      canvasRef.current.height = H;
    }

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // Grass pattern
    ctx.fillStyle = '#143012';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < PITCH_WIDTH; i += 10) {
      ctx.fillStyle = (i / 10) % 2 === 0 ? '#183a15' : '#143012';
      ctx.fillRect(i * S, 0, 10 * S, H);
    }

    // Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 9.15 * S, 0, Math.PI * 2); ctx.stroke();
    
    // Areas
    ctx.strokeRect(0, (H - 40 * S) / 2, 16.5 * S, 40 * S);
    ctx.strokeRect(W - 16.5 * S, (H - 40 * S) / 2, 16.5 * S, 40 * S);

    const owner = matchState.players.find(p => p.hasBall);

    // Aim Assist
    if (owner && owner.side === TeamSide.HOME && hoveredPos) {
       ctx.beginPath();
       ctx.setLineDash([5, 10]);
       ctx.moveTo(owner.position.x * S, owner.position.y * S);
       ctx.lineTo(hoveredPos.x * S, hoveredPos.y * S);
       ctx.strokeStyle = hoveredPos.x > 95 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(255,255,255,0.2)';
       ctx.stroke();
       ctx.setLineDash([]);
    }

    // Ball Trails
    const ballSpeed = Math.sqrt(matchState.ball.velocity.x**2 + matchState.ball.velocity.y**2);
    if (ballSpeed > 1) {
      ballHistory.current.push({...matchState.ball.position});
      if (ballHistory.current.length > 8) ballHistory.current.shift();
      
      ballHistory.current.forEach((pos, i) => {
        ctx.beginPath();
        ctx.arc(pos.x * S, pos.y * S, BALL_RADIUS * S * (i/8), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${i * 0.05})`;
        ctx.fill();
      });
    } else {
      ballHistory.current = [];
    }

    // Players
    matchState.players.forEach(p => {
      const px = p.position.x * S;
      const py = p.position.y * S;

      // Selection Glow
      if (p.hasBall) {
        const pulse = 0.5 + Math.sin(Date.now() / 150) * 0.2;
        ctx.beginPath();
        ctx.arc(px, py, (PLAYER_RADIUS + 2) * S, 0, Math.PI * 2);
        ctx.fillStyle = p.side === TeamSide.HOME ? `rgba(37, 99, 235, ${pulse})` : `rgba(220, 38, 38, ${pulse})`;
        ctx.fill();
      }

      // Base Player Circle
      ctx.beginPath();
      ctx.arc(px, py, PLAYER_RADIUS * S, 0, Math.PI * 2);
      ctx.fillStyle = p.side === TeamSide.HOME ? '#2563eb' : '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Role Icon
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${S * 1.5}px Inter`;
      ctx.textAlign = 'center';
      const roleLetter = p.role[0];
      ctx.fillText(roleLetter, px, py + S * 0.5);

      // Exhaustion Visual
      if (p.actionCooldown > 0) {
        ctx.beginPath();
        ctx.arc(px, py, PLAYER_RADIUS * S, 0, (Math.PI * 2) * (p.actionCooldown / 25));
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Stamina Bar
      const barW = 5 * S;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px - barW/2, py + (PLAYER_RADIUS+2)*S, barW, 1 * S);
      ctx.fillStyle = p.stamina > 40 ? '#10b981' : '#ef4444';
      ctx.fillRect(px - barW/2, py + (PLAYER_RADIUS+2)*S, (p.stamina/100)*barW, 1 * S);

      // Name label
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `800 ${S * 1.3}px Inter`;
      ctx.fillText(p.name, px, py - (PLAYER_RADIUS+3)*S);
    });

    // Ball
    const bx = matchState.ball.position.x * S;
    const by = matchState.ball.position.y * S;
    ctx.beginPath();
    ctx.arc(bx, by, BALL_RADIUS * S, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Ball rotation effect (visual only)
    ctx.beginPath();
    ctx.moveTo(bx, by);
    const rot = (matchState.timer * 10) % (Math.PI * 2);
    ctx.lineTo(bx + Math.cos(rot)*BALL_RADIUS*S, by + Math.sin(rot)*BALL_RADIUS*S);
    ctx.stroke();

    // Overlays
    if (matchState.phase === MatchPhase.GOAL_CELEBRATION) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = `italic 900 ${S * 18}px Inter`;
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 40;
      ctx.fillText('¡GOOOOOOL!', W / 2, H / 2 + (Math.sin(Date.now()/100)*10));
    }

    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frameId: number;
    const render = () => {
      draw(ctx);
      frameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frameId);
  }, [matchState, hoveredPos, selectedAction, shake]);

  return (
    <div className="w-full flex justify-center bg-black/40 p-4 rounded-[3rem] border border-white/5">
      <canvas 
        ref={canvasRef} 
        onMouseMove={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const S = rect.width / PITCH_WIDTH;
          setHoveredPos({ x: (e.clientX - rect.left) / S, y: (e.clientY - rect.top) / S });
        }}
        onMouseDown={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const S = rect.width / PITCH_WIDTH;
          const x = (e.clientX - rect.left) / S;
          const y = (e.clientY - rect.top) / S;
          const p = matchState.players.find(p => Math.sqrt((p.position.x-x)**2 + (p.position.y-y)**2) < PLAYER_RADIUS * 4);
          if (p && onPlayerClick) onPlayerClick(p);
          else if (onPitchClick) onPitchClick({ x, y });
        }}
        className="max-w-full max-h-[70vh] rounded-2xl cursor-crosshair shadow-2xl"
      />
    </div>
  );
};

export default Pitch;
