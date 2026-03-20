import React, { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export interface QuestionItem {
  id: string; content: string; options?: string[];
  correctAnswer?: string; type: string; level: string;
}
interface Props { initialQuestions: QuestionItem[]; onBack: () => void; }
interface GameQ { q: string; opts: string[]; corr: number; }

function toGameQ(q: QuestionItem): GameQ | null {
  const opts = q.options;
  if (!opts || opts.length < 2) return null;
  const ca = (q.correctAnswer || '').trim().toUpperCase();
  const letters = ['A','B','C','D'];
  let corr = letters.indexOf(ca);
  if (corr === -1) corr = opts.findIndex(o => o.trim().toLowerCase() === (q.correctAnswer||'').trim().toLowerCase());
  if (corr === -1) corr = 0;
  return { q: q.content, opts, corr };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Screen = 'setup' | 'game' | 'end';
type GameMode = 'speed' | 'long';
type Team = 'blue' | 'red';

const TIME_OPTIONS = [5, 10, 15, 20, 0]; // 0 = unlimited
const LETTERS = ['A', 'B', 'C', 'D'];
const STEP_WIN = 0.18;   // rope shift per correct answer
const STEP_LOSS = 0.06;  // rope shift for wrong

export default function KeoCoKienThucGame({ initialQuestions, onBack }: Props) {
  // ── Setup state ────────────────────────────────────────────────
  const [mode, setMode] = useState<GameMode>('speed');
  const [blueTeamName, setBlueTeamName] = useState('Đội Xanh');
  const [redTeamName, setRedTeamName] = useState('Đội Đỏ');
  const [timePerQ, setTimePerQ] = useState(10);

  // ── Game state ────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>('setup');
  const [questions, setQuestions] = useState<GameQ[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [currentTeam, setCurrentTeam] = useState<Team>('blue');
  const [scoreBlue, setScoreBlue] = useState(0);
  const [scoreRed, setScoreRed] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [ansState, setAnsState] = useState<('idle'|'correct'|'wrong')[]>(['idle','idle','idle','idle']);
  const [countdown, setCountdown] = useState(10);
  const [winner, setWinner] = useState<Team | 'draw' | null>(null);
  const [showFeedback, setShowFeedback] = useState<{ok: boolean; msg: string} | null>(null);

  // ── Rope animation ────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ropePos = useRef(0);        // -1 = blue wins, +1 = red wins
  const ropeTarget = useRef(0);
  const activeRef = useRef(false);
  const animRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const scoreBlueRef = useRef(0);
  const scoreRedRef = useRef(0);
  const ropeTargetRef = useRef(0);

  // ── Draw canvas ────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // Smooth rope
    ropePos.current += (ropeTarget.current - ropePos.current) * 0.08;

    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, '#87ceeb');
    sky.addColorStop(1, '#e0f4ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.7);

    // Ground
    const gnd = ctx.createLinearGradient(0, H * 0.7, 0, H);
    gnd.addColorStop(0, '#4ade80');
    gnd.addColorStop(1, '#16a34a');
    ctx.fillStyle = gnd;
    ctx.fillRect(0, H * 0.7, W, H * 0.3);

    // Ground line
    ctx.strokeStyle = '#15803d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, H * 0.7); ctx.lineTo(W, H * 0.7); ctx.stroke();

    const groundY = H * 0.65;
    const halfW = W / 2;
    const pullRange = W * 0.38;
    const knotX = halfW + ropePos.current * pullRange;

    // Center flag zone
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(halfW - 12, groundY - 70, 24, 70);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.moveTo(halfW, groundY - 70); ctx.lineTo(halfW + 22, groundY - 60); ctx.lineTo(halfW, groundY - 50); ctx.fill();

    // Rope shadow
    ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(knotX - pullRange * 1.1, groundY); ctx.lineTo(knotX + pullRange * 1.1, groundY); ctx.stroke();
    ctx.shadowBlur = 0;

    // Rope texture
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = 4;
    for (let i = -10; i < 10; i++) {
      const segX = knotX + i * 22;
      ctx.beginPath();
      ctx.moveTo(segX - 8, groundY - 3);
      ctx.lineTo(segX + 8, groundY + 3);
      ctx.stroke();
    }

    // Knot (center marker)
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(knotX, groundY, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(knotX, groundY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText('●', knotX, groundY);

    // Progress bar under rope
    const barW = 200, barH = 8, barX = halfW - barW / 2, barY = groundY + 22;
    ctx.fillStyle = '#e2e8f0'; ctx.beginPath();
    (ctx as any).roundRect?.(barX, barY, barW, barH, 4);
    ctx.fill();
    const progress = (ropePos.current + 1) / 2;
    const barFill = progress * barW;
    ctx.fillStyle = ropePos.current < 0 ? '#3b82f6' : '#ef4444';
    ctx.beginPath();
    (ctx as any).roundRect?.(barX, barY, Math.max(4, barFill), barH, 4);
    ctx.fill();
    // Knot indicator on bar
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(barX + barFill, barY + barH / 2, 7, 0, Math.PI * 2); ctx.fill();

    // Draw stick figures
    const drawTeam = (anchorX: number, side: Team) => {
      const color = side === 'blue' ? '#2563eb' : '#dc2626';
      const dir = side === 'blue' ? -1 : 1;
      const lean = 0.28;
      const count = 3;
      for (let i = 0; i < count; i++) {
        const fx = anchorX + dir * (20 + i * 36);
        const fy = groundY;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(side === 'blue' ? lean : -lean);
        // Body
        ctx.fillStyle = color;
        ctx.fillRect(-8, -40, 16, 34);
        // Head
        ctx.beginPath(); ctx.arc(0, -50, 11, 0, Math.PI * 2); ctx.fill();
        // Face smile
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, -48, 5, 0.2, Math.PI - 0.2); ctx.stroke();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-3, -51, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -51, 1.5, 0, Math.PI * 2); ctx.fill();
        // Legs
        ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-8, 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(8, 14); ctx.stroke();
        ctx.restore();
      }
      // Team name badge
      ctx.fillStyle = side === 'blue' ? 'rgba(37,99,235,0.85)' : 'rgba(220,38,38,0.85)';
      const label = side === 'blue' ? blueTeamName : redTeamName;
      const lw = ctx.measureText(label).width + 20;
      const lx = anchorX + dir * (20 + (count - 1) * 36 / 2) - lw / 2;
      ctx.beginPath();
      (ctx as any).roundRect?.(lx, groundY - 100, lw, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, lx + lw / 2, groundY - 85);
    };

    drawTeam(knotX - 16, 'blue');
    drawTeam(knotX + 16, 'red');

    if (activeRef.current) animRef.current = requestAnimationFrame(drawCanvas);
  }, [blueTeamName, redTeamName]);

  // ── Canvas resize ───────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.parentElement?.offsetWidth || 400;
      canvas.height = canvas.parentElement?.offsetHeight || 300;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [screen]);

  useEffect(() => {
    if (screen === 'game') {
      activeRef.current = true;
      animRef.current = requestAnimationFrame(drawCanvas);
    } else {
      activeRef.current = false;
      cancelAnimationFrame(animRef.current);
    }
    return () => { activeRef.current = false; cancelAnimationFrame(animRef.current); };
  }, [screen, drawCanvas]);

  // ── Countdown timer ─────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game' || answered || timePerQ === 0) return;
    setCountdown(timePerQ);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          handleTimeUp();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qIndex, currentTeam, screen, answered, timePerQ]);

  const handleTimeUp = () => {
    if (answered) return;
    setAnswered(true);
    const q = questions[qIndex];
    if (!q) return;
    setAnsState(q.opts.map((_, i) => i === q.corr ? 'correct' : 'idle') as any);
    // Rope shifts toward opponent
    const shift = STEP_LOSS;
    ropeTarget.current = Math.max(-1, Math.min(1, ropeTarget.current + (currentTeam === 'blue' ? shift : -shift)));
    ropeTargetRef.current = ropeTarget.current;
    setShowFeedback({ ok: false, msg: '⏰ Hết giờ! Mất lượt.' });
    setTimeout(() => advanceNext(), 1500);
  };

  // ── Start game ───────────────────────────────────────────────────
  const startGame = () => {
    const valid = initialQuestions.map(toGameQ).filter(Boolean) as GameQ[];
    if (valid.length < 2) return;
    const shuffled = shuffle(valid);
    setQuestions(shuffled);
    setQIndex(0);
    setCurrentTeam('blue');
    setScoreBlue(0); setScoreRed(0);
    scoreBlueRef.current = 0; scoreRedRef.current = 0;
    ropePos.current = 0; ropeTarget.current = 0; ropeTargetRef.current = 0;
    setAnswered(false);
    setAnsState(['idle','idle','idle','idle']);
    setWinner(null);
    setShowFeedback(null);
    setScreen('game');
  };

  // ── Handle answer ────────────────────────────────────────────────
  const handleAnswer = (idx: number) => {
    if (answered) return;
    clearInterval(timerRef.current);
    setAnswered(true);
    const q = questions[qIndex];
    if (!q) return;
    const isCorrect = idx === q.corr;

    setAnsState(q.opts.map((_, i) =>
      i === q.corr ? 'correct' : i === idx && !isCorrect ? 'wrong' : 'idle'
    ) as any);

    if (isCorrect) {
      if (currentTeam === 'blue') { setScoreBlue(s => { scoreBlueRef.current = s + 1; return s + 1; }); }
      else { setScoreRed(s => { scoreRedRef.current = s + 1; return s + 1; }); }
      ropeTarget.current = Math.max(-1, Math.min(1,
        ropeTarget.current + (currentTeam === 'blue' ? -STEP_WIN : STEP_WIN)
      ));
      ropeTargetRef.current = ropeTarget.current;
      setShowFeedback({ ok: true, msg: '✅ Chính xác! Kéo mạnh thêm!' });
    } else {
      ropeTarget.current = Math.max(-1, Math.min(1,
        ropeTarget.current + (currentTeam === 'blue' ? STEP_LOSS : -STEP_LOSS)
      ));
      ropeTargetRef.current = ropeTarget.current;
      setShowFeedback({ ok: false, msg: '❌ Sai rồi! Bị đối thủ lấn lướt.' });
    }

    // Check if rope hit the limit
    if (Math.abs(ropeTarget.current) >= 0.99) {
      setTimeout(() => endGame(), 1400);
      return;
    }

    setTimeout(() => {
      setShowFeedback(null);
      advanceNext();
    }, 1400);
  };

  const advanceNext = () => {
    const nextIdx = qIndex + 1;
    if (nextIdx >= questions.length) {
      endGame();
      return;
    }
    // In speed mode: alternate teams every question. In long mode: stay same team until wrong.
    const nextTeam = mode === 'speed'
      ? (currentTeam === 'blue' ? 'red' : 'blue')
      : currentTeam;
    setCurrentTeam(nextTeam);
    setQIndex(nextIdx);
    setAnswered(false);
    setAnsState(['idle','idle','idle','idle']);
    setShowFeedback(null);
  };

  const endGame = () => {
    clearInterval(timerRef.current);
    activeRef.current = false;
    const rt = ropeTargetRef.current;
    let w: Team | 'draw';
    if (rt <= -0.6) w = 'blue';
    else if (rt >= 0.6) w = 'red';
    else if (scoreBlueRef.current > scoreRedRef.current) w = 'blue';
    else if (scoreRedRef.current > scoreBlueRef.current) w = 'red';
    else w = 'draw';
    setWinner(w);
    setScreen('end');
  };

  // ── Helpers ────────────────────────────────────────────────────
  const validCount = initialQuestions.filter(q => q.options && q.options.length >= 2).length;
  const q = questions[qIndex];

  // ══════════════════════════════════════════════════════════════
  // SETUP SCREEN
  // ══════════════════════════════════════════════════════════════
  if (screen === 'setup') {
    return (
      <div className="min-h-[600px] rounded-3xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fef3c7 60%,#fde68a 100%)' }}>

        {/* Header */}
        <div className="relative text-center py-8 px-4"
          style={{ background: 'linear-gradient(135deg,#1d4ed8,#7c3aed,#ec4899)' }}>
          <button onClick={onBack}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
            ← Đổi Game
          </button>
          <div className="text-5xl mb-2">🏆</div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Kéo Co Kiến Thức</h1>
          <p className="text-white/80 text-sm mt-1">Trò chơi trắc nghiệm đối kháng siêu vui!</p>
        </div>

        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left: Mode + Timer */}
          <div className="space-y-5">
            {/* Game Mode */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest mb-3">⚡ Chế Độ Chơi</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'speed', icon: '🏎️', title: 'Thi Tốc Độ', desc: 'Đổi lượt mỗi câu' },
                  { id: 'long',  icon: '🏋️', title: 'Đua Đường Dài', desc: 'Đội nào sai mới đổi lượt' },
                ].map(m => (
                  <button key={m.id} onClick={() => setMode(m.id as GameMode)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      mode === m.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300 bg-white'
                    }`}>
                    <div className="text-2xl mb-1">{m.icon}</div>
                    <div className={`font-black text-sm ${mode === m.id ? 'text-indigo-700' : 'text-gray-800'}`}>{m.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Timer */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest mb-3">⏱️ Thời Gian Mỗi Câu</h3>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map(t => (
                  <button key={t} onClick={() => setTimePerQ(t)}
                    className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${
                      timePerQ === t
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                    {t === 0 ? '∞ Không giới hạn' : `${t}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Team Names */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest mb-4">🏷️ Đặt Tên Đội</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1 mb-1">
                    🔵 Đội Xanh
                  </label>
                  <input value={blueTeamName} onChange={e => setBlueTeamName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-blue-200 focus:border-blue-500 outline-none font-bold text-blue-800 bg-blue-50 transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-red-600 uppercase tracking-wide flex items-center gap-1 mb-1">
                    🔴 Đội Đỏ
                  </label>
                  <input value={redTeamName} onChange={e => setRedTeamName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-red-200 focus:border-red-500 outline-none font-bold text-red-800 bg-red-50 transition-all" />
                </div>
              </div>
            </div>

            {/* Stats info */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest">📝 Bộ câu hỏi</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${validCount >= 2 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {validCount} câu
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {validCount >= 2
                  ? `✅ Đã sẵn sàng! ${validCount} câu trắc nghiệm sẽ được xáo trộn ngẫu nhiên.`
                  : '⚠️ Cần ít nhất 2 câu trắc nghiệm có đáp án để bắt đầu.'}
              </p>
            </div>

            {/* Start button */}
            <button onClick={startGame} disabled={validCount < 2}
              className="w-full py-4 rounded-2xl font-black text-xl text-white shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', boxShadow: '0 8px 32px rgba(239,68,68,0.35)' }}>
              🎮 BẮT ĐẦU KÉO CO!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // END SCREEN
  // ══════════════════════════════════════════════════════════════
  if (screen === 'end') {
    const isDraw = winner === 'draw';
    const winName = winner === 'blue' ? blueTeamName : winner === 'red' ? redTeamName : 'HÒA!';
    const winColor = winner === 'blue' ? '#2563eb' : winner === 'red' ? '#dc2626' : '#7c3aed';
    return (
      <div className="min-h-[600px] rounded-3xl flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'linear-gradient(160deg,#1e1b4b,#312e81,#4c1d95)' }}>
        <div className="mb-8">
          <div className="text-8xl mb-4 animate-bounce">{isDraw ? '🤝' : '🏆'}</div>
          <h2 className="text-5xl font-black text-yellow-400 uppercase tracking-tighter mb-2">
            {isDraw ? 'HÒA!' : 'CHIẾN THẮNG!'}
          </h2>
          <div className="text-3xl font-black mt-2" style={{ color: winColor }}>
            {winName}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-8 border border-white/20 w-full max-w-sm">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">🔵 {blueTeamName}</div>
              <div className="text-4xl font-black text-white">{scoreBlue}</div>
              <div className="text-xs text-white/50 mt-1">câu đúng</div>
            </div>
            <div>
              <div className="text-xs font-bold text-red-300 uppercase tracking-widest mb-1">🔴 {redTeamName}</div>
              <div className="text-4xl font-black text-white">{scoreRed}</div>
              <div className="text-xs text-white/50 mt-1">câu đúng</div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-xs text-white/50">Tổng {questions.length} câu</div>
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={startGame}
            className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-2xl font-black text-lg transition-all hover:scale-105">
            🔄 Chơi lại
          </button>
          <button onClick={() => setScreen('setup')}
            className="px-8 py-3 bg-white/15 hover:bg-white/25 text-white rounded-2xl font-black text-lg transition-all">
            ⚙️ Thiết lập lại
          </button>
          <button onClick={onBack}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-lg transition-all">
            ← Đổi Game
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // GAME SCREEN
  // ══════════════════════════════════════════════════════════════
  const isBlue = currentTeam === 'blue';
  const teamColor = isBlue ? '#1d4ed8' : '#dc2626';
  const teamName = isBlue ? blueTeamName : redTeamName;

  return (
    <div className="rounded-3xl overflow-hidden flex flex-col" style={{ minHeight: 620, background: '#0f172a' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10"
        style={{ background: '#1e293b' }}>
        <button onClick={onBack} className="text-white/60 hover:text-white text-sm font-bold transition-colors">
          ← Thoát
        </button>

        {/* Score */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-900/60 px-4 py-1.5 rounded-xl border border-blue-500/30">
            <span className="text-blue-400 text-lg">🔵</span>
            <span className="font-black text-white text-lg">{scoreBlue}</span>
          </div>
          <div className="text-white/40 font-black text-sm">VS</div>
          <div className="flex items-center gap-2 bg-red-900/60 px-4 py-1.5 rounded-xl border border-red-500/30">
            <span className="font-black text-white text-lg">{scoreRed}</span>
            <span className="text-red-400 text-lg">🔴</span>
          </div>
        </div>

        {/* Question counter + timer */}
        <div className="flex items-center gap-3">
          <div className="text-white/50 text-xs font-bold">
            {qIndex + 1} / {questions.length}
          </div>
          {timePerQ > 0 && (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg border-2 transition-all ${
              countdown <= 3
                ? 'border-red-500 text-red-400 bg-red-900/30 animate-pulse'
                : 'border-white/20 text-white bg-white/5'
            }`}>
              {answered ? '–' : countdown}
            </div>
          )}
        </div>
      </header>

      {/* Rope Canvas */}
      <div className="relative bg-gradient-to-b from-sky-400 to-sky-200 flex-shrink-0" style={{ height: 220 }}>
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Turn indicator */}
      <div className="flex items-center justify-center py-3 border-b border-white/10"
        style={{ background: `${teamColor}22` }}>
        <div className="flex items-center gap-2 px-5 py-1.5 rounded-full border"
          style={{ borderColor: `${teamColor}66`, background: `${teamColor}33` }}>
          <span>{isBlue ? '🔵' : '🔴'}</span>
          <span className="font-black text-white text-sm">{teamName} đang trả lời</span>
        </div>
      </div>

      {/* Feedback toast */}
      {showFeedback && (
        <div className={`mx-5 mt-3 px-5 py-3 rounded-2xl text-center font-bold text-sm ${
          showFeedback.ok ? 'bg-green-500/20 border border-green-500/40 text-green-300' : 'bg-red-500/20 border border-red-500/40 text-red-300'
        }`}>
          {showFeedback.msg}
        </div>
      )}

      {/* Question + options */}
      <div className="flex-1 overflow-y-auto p-5">
        {q && (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Question */}
            <div className="bg-white/8 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-white text-base font-semibold leading-relaxed">
                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {q.q}
                </Markdown>
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {q.opts.map((opt, i) => {
                const state = ansState[i];
                const isActive = !answered;
                return (
                  <button key={i} onClick={() => isActive && handleAnswer(i)}
                    disabled={answered && state === 'idle'}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200 font-semibold ${
                      state === 'correct'
                        ? 'bg-green-500 border-green-400 text-white scale-[1.02] shadow-lg shadow-green-500/30'
                        : state === 'wrong'
                        ? 'bg-red-500 border-red-400 text-white'
                        : isActive
                        ? 'bg-white/8 border-white/15 text-white hover:bg-white/15 hover:border-white/30 cursor-pointer hover:-translate-y-0.5'
                        : 'bg-white/4 border-white/8 text-white/40 cursor-not-allowed'
                    }`}>
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      state === 'correct' ? 'bg-white/30 text-white' :
                      state === 'wrong'   ? 'bg-white/30 text-white' :
                                            'bg-white/10 text-white/70'
                    }`}>
                      {state === 'correct' ? '✓' : state === 'wrong' ? '✗' : LETTERS[i]}
                    </span>
                    <span className="text-sm leading-snug">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {opt}
                      </Markdown>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${questions.length > 0 ? ((qIndex) / questions.length) * 100 : 0}%`,
            background: `linear-gradient(90deg, ${teamColor}, ${isBlue ? '#7c3aed' : '#f97316'})`
          }}
        />
      </div>
    </div>
  );
}
