import React, { useState, useEffect, useRef, useCallback } from 'react';
import MathText from './MathText';


interface QuestionItem {
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

const INIT_TIMER = 120;
const LETTERS = ['A','B','C','D'];

export default function TranhTaiKeoCoGame({ initialQuestions, onBack }: Props) {
  const [screen, setScreen]         = useState<'start'|'game'|'end'>('start');
  const [poolBlue, setPoolBlue]     = useState<GameQ[]>([]);
  const [poolRed, setPoolRed]       = useState<GameQ[]>([]);
  const [idxBlue, setIdxBlue]       = useState(0);
  const [idxRed, setIdxRed]         = useState(0);
  const [currentTeam, setCurrentTeam] = useState<'blue'|'red'>('blue');
  const [currentQ, setCurrentQ]     = useState<GameQ|null>(null);
  const [scoreBlue, setScoreBlue]   = useState(0);
  const [scoreRed, setScoreRed]     = useState(0);
  const [timer, setTimer]           = useState(INIT_TIMER);
  const [answered, setAnswered]     = useState(false);
  const [ansState, setAnsState]     = useState<('idle'|'correct'|'wrong')[]>(['idle','idle','idle','idle']);
  const [winner, setWinner]         = useState<'blue'|'red'|null>(null);
  const [toast, setToast]           = useState('');

  const canvasRef       = useRef<HTMLCanvasElement>(null);
  // Smooth animation: targetRopePos is what we move toward, ropePosRef is the rendered value
  const ropePosRef      = useRef(0);   // smoothed/rendered
  const targetRopePosRef = useRef(0);  // target
  const activeRef       = useRef(false);
  const animFrameRef    = useRef<number>(0);
  const timerInterval   = useRef<ReturnType<typeof setInterval>>();

  const fmt = (s: number) =>
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // ── Canvas ─────────────────────────────────────────────────────
  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const centerY = h * 0.68, centerX = w / 2;

    // Smooth easing
    const ease = 0.1;
    ropePosRef.current += (targetRopePosRef.current - ropePosRef.current) * ease;

    ctx.clearRect(0, 0, w, h);

    // Sky background
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, w, centerY);
    // Ground
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, centerY, w, h - centerY);

    // Dashed center line
    ctx.setLineDash([6,4]); ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, h); ctx.stroke();
    ctx.setLineDash([]);

    const pullRange = w * 0.42;
    const ropeX = centerX + ropePosRef.current * pullRange;

    // Rope
    ctx.strokeStyle = '#8b4513'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ropeX - w*0.42, centerY); ctx.lineTo(ropeX + w*0.42, centerY); ctx.stroke();
    // Center knot
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(ropeX, centerY, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'white';   ctx.beginPath(); ctx.arc(ropeX, centerY, 4,  0, Math.PI*2); ctx.fill();

    // Stick figures with dynamic lean
    const drawFigures = (baseX: number, side: 'blue'|'red') => {
      const color = side === 'blue' ? '#2563eb' : '#dc2626';
      const dir = side === 'blue' ? -1 : 1;
      const pulling = (side === 'blue' && ropePosRef.current < 0) || (side === 'red' && ropePosRef.current > 0);
      const leanAngle = pulling ? 0.35 : 0.15;
      const spacing = 44;
      for (let i = 0; i < 3; i++) {
        const x = baseX + dir * (28 + i * spacing);
        ctx.save();
        ctx.translate(x, centerY);
        ctx.rotate(side === 'blue' ? leanAngle : -leanAngle);
        ctx.fillStyle = color;
        ctx.fillRect(-12, -45, 24, 45);
        ctx.beginPath(); ctx.arc(0, -60, 14, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-10, 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( 4, 0); ctx.lineTo( 10, 22); ctx.stroke();
        ctx.restore();
      }
    };
    drawFigures(ropeX - 18, 'blue');
    drawFigures(ropeX + 18, 'red');

    // Team labels
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#1e3a8a'; ctx.fillText('ĐỘI XANH', centerX - pullRange*0.62, 22);
    ctx.fillStyle = '#991b1b'; ctx.fillText('ĐỘI ĐỎ',  centerX + pullRange*0.62, 22);

    if (activeRef.current) animFrameRef.current = requestAnimationFrame(drawGame);
  }, []);

  // Init canvas size + resize
  useEffect(() => {
    if (screen !== 'game') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = canvas.parentElement?.offsetWidth  || 320;
      canvas.height = canvas.parentElement?.offsetHeight || 400;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [screen]);

  // Start/stop animation loop
  useEffect(() => {
    if (screen === 'game') {
      activeRef.current = true;
      animFrameRef.current = requestAnimationFrame(drawGame);
    } else {
      activeRef.current = false;
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => { activeRef.current = false; cancelAnimationFrame(animFrameRef.current); };
  }, [screen, drawGame]);

  // ── Timer ─────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    activeRef.current = false;
    clearInterval(timerInterval.current);
    setScreen('end');
  }, []);

  useEffect(() => {
    if (screen !== 'game') return;
    timerInterval.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerInterval.current); endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerInterval.current);
  }, [screen, endGame]);

  // ── Stable refs ───────────────────────────────────────────────────
  const poolBlueRef   = useRef<GameQ[]>([]); useEffect(() => { poolBlueRef.current  = poolBlue;  }, [poolBlue]);
  const poolRedRef    = useRef<GameQ[]>([]); useEffect(() => { poolRedRef.current   = poolRed;   }, [poolRed]);
  const idxBlueRef    = useRef(0);           useEffect(() => { idxBlueRef.current   = idxBlue;   }, [idxBlue]);
  const idxRedRef     = useRef(0);           useEffect(() => { idxRedRef.current    = idxRed;    }, [idxRed]);
  const scoreBlueRef  = useRef(0);           useEffect(() => { scoreBlueRef.current = scoreBlue; }, [scoreBlue]);
  const scoreRedRef   = useRef(0);           useEffect(() => { scoreRedRef.current  = scoreRed;  }, [scoreRed]);

  const loadNextQ = useCallback((team: 'blue'|'red') => {
    const pool     = team === 'blue' ? poolBlueRef.current : poolRedRef.current;
    const idx      = team === 'blue' ? idxBlueRef.current  : idxRedRef.current;
    const other      = team === 'blue' ? 'red' : 'blue';
    const otherPool  = team === 'blue' ? poolRedRef.current  : poolBlueRef.current;
    const otherIdx   = team === 'blue' ? idxRedRef.current   : idxBlueRef.current;

    if (idx >= pool.length && otherIdx >= otherPool.length) { endGame(); return; }
    if (idx >= pool.length) {
      setCurrentTeam(other);
      const q = otherPool[otherIdx];
      if (team === 'blue') setIdxRed(i => i + 1); else setIdxBlue(i => i + 1);
      setCurrentQ(q); setAnswered(false); setAnsState(['idle','idle','idle','idle']); return;
    }
    const q = pool[idx];
    if (team === 'blue') setIdxBlue(i => i + 1); else setIdxRed(i => i + 1);
    setCurrentQ(q); setAnswered(false); setAnsState(['idle','idle','idle','idle']);
  }, [endGame]);

  // ── Start ─────────────────────────────────────────────────────────
  const startGame = () => {
    const valid = initialQuestions.map(toGameQ).filter(Boolean) as GameQ[];
    if (valid.length < 2) { showToast('⚠️ Cần ít nhất 2 câu trắc nghiệm!'); return; }
    const sh = shuffle(valid);
    const half = Math.floor(sh.length / 2);
    const pBlue = sh.slice(0, half);
    const pRed  = sh.slice(half);
    setPoolBlue(pBlue); setPoolRed(pRed);
    poolBlueRef.current = pBlue; poolRedRef.current = pRed;
    setIdxBlue(1);  idxBlueRef.current = 1;
    setIdxRed(0);   idxRedRef.current  = 0;
    setScoreBlue(0); setScoreRed(0); scoreBlueRef.current = 0; scoreRedRef.current = 0;
    ropePosRef.current = 0; targetRopePosRef.current = 0;
    setTimer(INIT_TIMER);
    setCurrentTeam('blue');
    setCurrentQ(pBlue[0]);
    setAnswered(false); setAnsState(['idle','idle','idle','idle']);
    setWinner(null);
    setScreen('game');
  };

  // ── Answer ────────────────────────────────────────────────────────
  const handleAnswer = (idx: number) => {
    if (answered || !currentQ) return;
    setAnswered(true);
    const isCorrect = idx === currentQ.corr;
    setAnsState(currentQ.opts.map((_, i) =>
      i === currentQ.corr ? 'correct' : i === idx && !isCorrect ? 'wrong' : 'idle'
    ) as ('idle'|'correct'|'wrong')[]);

    let newTarget = targetRopePosRef.current;
    if (isCorrect) {
      if (currentTeam === 'blue') { setScoreBlue(s => s + 1); newTarget -= 0.15; }
      else                         { setScoreRed(s => s + 1);  newTarget += 0.15; }
      showToast('✅ Chính xác! Bạn đang thắng thế.');
    } else {
      if (currentTeam === 'blue') newTarget += 0.05; else newTarget -= 0.05;
      showToast('❌ Sai rồi! Bị đối thủ lấn lướt.');
    }
    newTarget = Math.max(-1, Math.min(1, newTarget));
    targetRopePosRef.current = newTarget;

    if (newTarget <= -1 || newTarget >= 1) { clearInterval(timerInterval.current); endGame(); return; }
    setTimeout(() => {
      const next = currentTeam === 'blue' ? 'red' : 'blue';
      setCurrentTeam(next);
      loadNextQ(next);
    }, 1300);
  };

  // Resolve winner on end
  useEffect(() => {
    if (screen !== 'end') return;
    let w: 'blue'|'red';
    if      (targetRopePosRef.current <= -0.99)               w = 'blue';
    else if (targetRopePosRef.current >=  0.99)               w = 'red';
    else if (scoreBlueRef.current > scoreRedRef.current)      w = 'blue';
    else if (scoreRedRef.current  > scoreBlueRef.current)     w = 'red';
    else w = ropePosRef.current < 0 ? 'blue' : 'red';
    setWinner(w);
  }, [screen]);

  // ── Button style helpers ──────────────────────────────────────────
  const btnCls = (s: 'idle'|'correct'|'wrong') => {
    if (s === 'correct') return 'bg-green-500 text-white border-transparent';
    if (s === 'wrong')   return 'bg-red-500 text-white border-transparent shake';
    return 'bg-white text-gray-800 border-transparent hover:bg-gray-50 hover:-translate-y-0.5';
  };
  const letterCls = (s: 'idle'|'correct'|'wrong') => {
    if (s === 'correct') return 'bg-white text-green-600';
    if (s === 'wrong')   return 'bg-white text-red-600';
    return 'bg-slate-100 text-slate-600';
  };

  // ── START SCREEN ──────────────────────────────────────────────────
  if (screen === 'start') {
    const validCount = initialQuestions.filter(q => q.options && q.options.length >= 2).length;
    return (
      <div className="min-h-[560px] rounded-3xl flex flex-col items-center justify-center p-8 text-white text-center" style={{ background: '#1a1a1a' }}>
        <button onClick={onBack} className="self-start px-4 py-2 bg-white/10 rounded-xl text-sm mb-6 hover:bg-white/20">← Đổi Game</button>
        <div className="text-5xl mb-3">⚔️</div>
        <h1 className="text-4xl font-black italic uppercase text-yellow-400 mb-2 tracking-tighter">TRANH TÀI KÉO CO</h1>
        <p className="text-gray-400 mb-8">Hai đội đấu đả luân phiên — kéo dây về phía chiến thắng!</p>
        <div className="flex gap-8 mb-8">
          <div className="bg-blue-900 rounded-2xl p-6 text-center w-36 shadow-xl">
            <div className="text-3xl mb-1">🔵</div>
            <div className="font-black text-xl">Đội Xanh</div>
          </div>
          <div className="flex items-center text-3xl font-black text-yellow-400">VS</div>
          <div className="bg-red-900 rounded-2xl p-6 text-center w-36 shadow-xl">
            <div className="text-3xl mb-1">🔴</div>
            <div className="font-black text-xl">Đội Đỏ</div>
          </div>
        </div>
        <button onClick={startGame} disabled={validCount < 2}
          className="px-12 py-4 bg-indigo-600 text-white rounded-full text-2xl font-black shadow-2xl hover:bg-indigo-700 hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100">
          BẮT ĐẦU CHƠI
        </button>
        <p className="mt-4 text-gray-500 text-sm">{validCount} câu trắc nghiệm · {fmt(INIT_TIMER)} · đổi lượt mỗi câu</p>
        {validCount < 2 && <p className="text-red-400 text-sm mt-1">⚠️ Cần ít nhất 2 câu trắc nghiệm có đáp án</p>}
      </div>
    );
  }

  // ── END SCREEN ────────────────────────────────────────────────────
  if (screen === 'end') return (
    <div className="min-h-[560px] rounded-3xl flex flex-col items-center justify-center p-8 text-white text-center" style={{ background: '#1a1a1a' }}>
      <div className="text-7xl mb-4">🏆</div>
      <h2 className={`text-4xl font-black uppercase mb-2 ${winner === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
        {winner === 'blue' ? 'ĐỘI XANH CHIẾN THẮNG' : 'ĐỘI ĐỎ CHIẾN THẮNG'}
      </h2>
      <p className="text-2xl font-bold text-gray-400 mb-8">Tỉ số: {scoreBlue} – {scoreRed}</p>
      <div className="flex gap-4">
        <button onClick={startGame} className="px-8 py-3 bg-indigo-600 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all">Chơi lại</button>
        <button onClick={onBack}   className="px-8 py-3 bg-white/10 rounded-2xl font-black text-lg hover:bg-white/20 transition-all">Đổi Game</button>
      </div>
    </div>
  );

  // ── GAME SCREEN ───────────────────────────────────────────────────
  const isBlue = currentTeam === 'blue';

  const renderAnswers = (active: boolean) => (
    <div>
      {(currentQ?.opts || ['---','---','---','---']).map((opt, i) => (
        <button key={i} onClick={() => active && handleAnswer(i)}
          disabled={answered && ansState[i] === 'idle'}
          className={`flex items-start w-full text-left border-2 shadow-md transition-all mb-3
            ${btnCls(ansState[i])} ${!active ? 'pointer-events-none' : ''}`}
          style={{ padding: '1.25rem', borderRadius: '1rem', minHeight: 64 }}>
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 mr-4 mt-0.5 border border-slate-200 ${letterCls(ansState[i])}`}>
            {LETTERS[i]}
          </span>
          <MathText inline className={`font-semibold text-sm leading-relaxed break-words flex-1 ${ansState[i] !== 'idle' ? 'text-white' : 'text-slate-800'}`}>{opt}</MathText>
        </button>
      ))}
    </div>
  );

  return (
    <div className="rounded-3xl overflow-hidden flex flex-col" style={{ background: '#1a1a1a', minHeight: 560 }}>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-8 py-3 rounded-full shadow-2xl z-50 font-bold text-sm pointer-events-none">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-[#222] py-3 px-4 flex justify-between items-center border-b border-gray-800 flex-shrink-0">
        <button onClick={onBack} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs text-gray-300 transition">← Thoát</button>
        <div className="flex items-center bg-black/40 px-6 py-1 rounded-full border border-gray-700">
          <span className="text-pink-500 mr-2 text-xl">⏰</span>
          <span className={`text-2xl font-bold tracking-widest ${timer < 20 ? 'text-red-400' : 'text-white'}`}>{fmt(timer)}</span>
        </div>
        <div className="flex gap-3 text-sm font-bold text-white">
          <span className="bg-blue-900 px-3 py-1 rounded">🔵 {scoreBlue}</span>
          <span className="bg-red-900  px-3 py-1 rounded">{scoreRed} 🔴</span>
        </div>
      </header>

      <main className="flex flex-grow overflow-hidden" style={{ minHeight: 460 }}>
        {/* ── Blue side ── */}
        <section className="w-[35%] flex flex-col p-5 border-r border-black/20 transition-all duration-500"
          style={{ background: '#1e3a8a', filter: isBlue ? 'brightness(1.1)' : 'grayscale(0.5) brightness(0.5)', pointerEvents: isBlue ? 'auto' : 'none' }}>
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase">Đội Xanh</h2>
            <div className="bg-yellow-500 text-black w-10 h-10 flex items-center justify-center rounded font-black text-xl shadow-lg">{scoreBlue}</div>
          </div>
          <div className="flex flex-col overflow-y-auto flex-grow" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
            <div className="bg-black/25 p-5 rounded-2xl border border-white/10 mb-4 flex items-center justify-center flex-shrink-0" style={{ minHeight: 130 }}>
              {isBlue
                ? <MathText className="text-lg font-bold text-center leading-relaxed text-white w-full">{currentQ?.q || '...'}</MathText>
                : <span className="opacity-30 italic text-base text-white">Đang chờ đối thủ...</span>
              }
            </div>
            {renderAnswers(isBlue)}
          </div>
        </section>

        {/* ── Canvas center ── */}
        <section className="w-[30%] bg-white relative flex flex-col flex-shrink-0">
          <div className="absolute inset-y-0 left-1/2 -ml-px border-l border-dashed border-gray-300 z-0" />
          <canvas ref={canvasRef} className="w-full h-full z-10" />
          {/* Rope position bar */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="w-28 h-2.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${((targetRopePosRef.current + 1) / 2) * 100}%`,
                  background: targetRopePosRef.current < 0 ? '#2563eb' : '#dc2626'
                }} />
            </div>
          </div>
        </section>

        {/* ── Red side ── */}
        <section className="w-[35%] flex flex-col p-5 border-l border-black/20 transition-all duration-500"
          style={{ background: '#991b1b', filter: !isBlue ? 'brightness(1.1)' : 'grayscale(0.5) brightness(0.5)', pointerEvents: !isBlue ? 'auto' : 'none' }}>
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <div className="bg-yellow-500 text-black w-10 h-10 flex items-center justify-center rounded font-black text-xl shadow-lg">{scoreRed}</div>
            <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase text-right">Đội Đỏ</h2>
          </div>
          <div className="flex flex-col overflow-y-auto flex-grow" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
            <div className="bg-black/25 p-5 rounded-2xl border border-white/10 mb-4 flex items-center justify-center flex-shrink-0" style={{ minHeight: 130 }}>
              {!isBlue
                ? <MathText className="text-lg font-bold text-center leading-relaxed text-white w-full">{currentQ?.q || '...'}</MathText>
                : <span className="opacity-30 italic text-base text-white">Đang chờ đối thủ...</span>
              }
            </div>
            {renderAnswers(!isBlue)}
          </div>
        </section>
      </main>

      <style>{`
        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          10%,90%{transform:translate3d(-1px,0,0);}
          20%,80%{transform:translate3d(2px,0,0);}
          30%,50%,70%{transform:translate3d(-4px,0,0);}
          40%,60%{transform:translate3d(4px,0,0);}
        }
      `}</style>
    </div>
  );
}
