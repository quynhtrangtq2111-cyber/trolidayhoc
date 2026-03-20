import React, { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export interface QuestionItem {
  id: string;
  content: string;
  options?: string[];
  correctAnswer?: string;
  type: string;
  level: string;
}

interface ThapTriTueProps {
  initialQuestions: QuestionItem[];
  onBack: () => void;
}

type Screen = 'home' | 'play' | 'result';
type GameQuestion = { question: string; type: 'TF' | 'Short'; answer: string };

const FLOOR_COLORS = ['#fbbf24', '#f59e0b', '#d97706', '#b45309'];
const MAX_MISTAKES = 3;

function normalizeAnswer(str: string): string {
  return (str || '').toString().toLowerCase().replace(/[\s$\\{}^_]/g, '');
}

function convertToGameQuestions(qs: QuestionItem[]): GameQuestion[] {
  return qs.map((q) => {
    const isTF = q.type === 'Đúng / Sai' || (q.options && q.options.length === 2 &&
      q.options.every(o => ['đúng','sai','true','false','đ','s'].includes(o.toLowerCase().trim())));
    
    if (isTF) {
      // Resolve correctAnswer letter to actual text value
      let answer = q.correctAnswer || 'Đúng';
      if (q.options && ['A','B','C','D'].includes(answer)) {
        const idx = ['A','B','C','D'].indexOf(answer);
        answer = q.options[idx] || answer;
      }
      return { question: q.content, type: 'TF', answer };
    } else {
      // For short-answer: resolve letter to actual text if needed
      let answer = q.correctAnswer || '';
      if (q.options && ['A','B','C','D'].includes(answer)) {
        const idx = ['A','B','C','D'].indexOf(answer);
        answer = q.options[idx] || answer;
      }
      return { question: q.content, type: 'Short', answer };
    }
  });
}

export default function ThapTriTueGame({ initialQuestions, onBack }: ThapTriTueProps) {
  const [screen, setScreen] = useState<Screen>('home');
  const [gameQuestions] = useState<GameQuestion[]>(() => convertToGameQuestions(initialQuestions));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [towerFloors, setTowerFloors] = useState<{ color: string; isUpgraded: boolean }[]>([]);
  const [feedback, setFeedback] = useState<{text: string; ok: boolean} | null>(null);
  const [shortAns, setShortAns] = useState('');
  const [shake, setShake] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [finished, setFinished] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const towerSideRef = useRef<HTMLDivElement>(null);

  // Draw tower on canvas
  const drawTower = useCallback((floors: { color: string; isUpgraded: boolean }[]) => {
    const canvas = canvasRef.current;
    const container = towerSideRef.current;
    if (!canvas || !container) return;
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight - 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const floorH = 38, floorW = Math.min(160, canvas.width * 0.6);
    const centerX = canvas.width / 2;
    let y = canvas.height - floorH - 4;
    floors.forEach((f) => {
      ctx.fillStyle = f.isUpgraded ? '#a855f7' : f.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      const r = 6;
      const x = centerX - floorW / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + floorW - r, y);
      ctx.quadraticCurveTo(x + floorW, y, x + floorW, y + r);
      ctx.lineTo(x + floorW, y + floorH - r);
      ctx.quadraticCurveTo(x + floorW, y + floorH, x + floorW - r, y + floorH);
      ctx.lineTo(x + r, y + floorH);
      ctx.quadraticCurveTo(x, y + floorH, x, y + floorH - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      y -= (floorH + 3);
    });
  }, []);

  useEffect(() => {
    if (screen === 'play') {
      drawTower(towerFloors);
    }
  }, [towerFloors, screen, drawTower]);

  useEffect(() => {
    const handleResize = () => { drawTower(towerFloors); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [towerFloors, drawTower]);

  const showFeedbackMsg = (text: string, ok: boolean) => {
    setFeedback({ text, ok });
    setTimeout(() => setFeedback(null), 2000);
  };

  const advance = useCallback((newMistakes: number, newFloors: typeof towerFloors, newIdx: number, isWin?: boolean) => {
    setTimeout(() => {
      setIsAnswered(false);
      if (newMistakes >= MAX_MISTAKES || isWin === false) {
        setGameOver(true);
        setFinished(true);
        setScreen('result');
        return;
      }
      if (newIdx >= gameQuestions.length) {
        setFinished(true);
        setScreen('result');
        return;
      }
      setCurrentIdx(newIdx);
      setShortAns('');
    }, 1200);
  }, [gameQuestions.length]);

  const submit = useCallback((answer: string) => {
    if (isAnswered) return;
    setIsAnswered(true);
    const q = gameQuestions[currentIdx];
    const isCorrect = normalizeAnswer(answer) === normalizeAnswer(q.answer);

    if (isCorrect) {
      const pts = q.type === 'TF' ? 10 : (score || 50) * 2;
      setScore(s => s + pts);
      const newFloors = [...towerFloors, {
        color: FLOOR_COLORS[towerFloors.length % FLOOR_COLORS.length],
        isUpgraded: q.type === 'Short'
      }];
      setTowerFloors(newFloors);
      setCorrectCount(c => c + 1);
      showFeedbackMsg('CHÍNH XÁC! 🎉', true);
      advance(mistakes, newFloors, currentIdx + 1);
    } else {
      const newMistakes = mistakes + 1;
      setMistakes(newMistakes);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      showFeedbackMsg(`CHƯA ĐÚNG! Đáp án: ${q.answer}`, false);
      if (newMistakes >= MAX_MISTAKES) {
        advance(newMistakes, towerFloors, currentIdx + 1, false);
      } else {
        advance(newMistakes, towerFloors, currentIdx + 1);
      }
    }
  }, [isAnswered, currentIdx, gameQuestions, score, towerFloors, mistakes, advance]);

  const startGame = () => {
    setCurrentIdx(0); setScore(0); setMistakes(0); setCorrectCount(0);
    setTowerFloors([]); setShortAns(''); setIsAnswered(false);
    setGameOver(false); setFinished(false);
    setScreen('play');
    setTimeout(() => drawTower([]), 100);
  };

  // ── HOME SCREEN ──
  if (screen === 'home') {
    return (
      <div className="w-full h-full min-h-[600px] flex flex-col items-center justify-center text-center p-8 rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)' }}>
        <div className="text-9xl mb-4" style={{ animation: 'float 3s ease-in-out infinite', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}>
          🏰
        </div>
        <h1 className="text-5xl font-black text-white mb-3 tracking-tighter uppercase drop-shadow-lg">Tháp Trí Tuệ</h1>
        <p className="text-sky-100 text-lg font-medium mb-8 max-w-md leading-relaxed">
          Trả lời đúng để xây từng tầng tháp. Tối đa <strong>3 lần sai</strong> trước khi tháp đổ!
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <button onClick={onBack} className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white font-bold py-4 px-8 rounded-2xl transition-all active:scale-95 border border-white/30">
            ← Quay lại
          </button>
          <button onClick={startGame} className="bg-white text-sky-600 font-black py-4 px-12 rounded-2xl text-xl shadow-2xl hover:scale-105 transition-transform active:scale-95">
            BẮT ĐẦU CHƠI ({gameQuestions.length} câu)
          </button>
        </div>
        <style>{`@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }`}</style>
      </div>
    );
  }

  // ── RESULT SCREEN ──
  if (screen === 'result') {
    const accuracy = Math.round((correctCount / gameQuestions.length) * 100);
    let rank = { title: 'Người Tập Sự', icon: '🌱', color: 'from-slate-400 to-slate-600' };
    if (score > 500) rank = { title: 'Huyền Thoại Trí Tuệ', icon: '💎', color: 'from-indigo-600 to-purple-600' };
    else if (score > 200) rank = { title: 'Kiến Trúc Sư Tài Ba', icon: '🏆', color: 'from-amber-400 to-orange-600' };
    else if (score > 50) rank = { title: 'Thợ Xây Tri Thức', icon: '🏗️', color: 'from-sky-400 to-blue-600' };

    return (
      <div className="w-full h-full min-h-[600px] flex items-center justify-center p-4 rounded-3xl"
        style={{ background: 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)' }}>
        <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden text-center">
          <div className={`w-full py-10 text-white flex flex-col items-center gap-3 bg-gradient-to-br ${rank.color}`}>
            <div className="text-7xl">{rank.icon}</div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">
              {gameOver ? 'THÁP ĐÃ ĐỔ!' : 'CHIẾN THẮNG!'}
            </h2>
            <div className="px-4 py-1 rounded-full text-xs font-bold bg-white/20 uppercase tracking-widest">
              {rank.title}
            </div>
          </div>
          <div className="p-8 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Điểm số</p>
                <p className="text-2xl font-black text-orange-500">{score}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Chiều cao</p>
                <p className="text-2xl font-black text-sky-500">{towerFloors.length * 5}m</p>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl flex justify-around">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Câu đúng</p>
                <p className="text-xl font-bold text-green-600">{correctCount}/{gameQuestions.length}</p>
              </div>
              <div className="w-[1px] bg-slate-200" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Chính xác</p>
                <p className="text-xl font-bold text-slate-700">{accuracy}%</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onBack} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-colors">
                ← Về app
              </button>
              <button onClick={startGame} className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95">
                Chơi lại
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAY SCREEN ──
  const q = gameQuestions[currentIdx];
  if (!q) return null;

  return (
    <div className="w-full h-full min-h-[600px] flex flex-col md:flex-row rounded-3xl overflow-hidden border-4 border-sky-200"
      style={{ fontFamily: "'Quicksand', sans-serif" }}>

      {/* Left: Tower Canvas */}
      <div
        ref={towerSideRef}
        className={`relative w-full md:w-2/5 h-64 md:h-full flex flex-col items-center justify-end overflow-hidden border-b-4 md:border-b-0 md:border-r-4 border-sky-200 ${shake ? 'shake-anim' : ''}`}
        style={{ background: 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)' }}>
        {/* Stats overlay */}
        <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm p-3 rounded-2xl shadow-lg z-10">
          <p className="text-xs font-bold text-sky-800 uppercase tracking-tight">
            Tháp cao: <span className="text-lg">{towerFloors.length * 5}</span>m
          </p>
          <p className="text-xs font-bold text-red-500 uppercase tracking-tight">
            Lỗi sai: <span>{mistakes}</span>/{MAX_MISTAKES}
            <span className="ml-1">{Array.from({ length: MAX_MISTAKES }).map((_, i) => (
              <span key={i}>{i < mistakes ? '❌' : '🔲'}</span>
            ))}</span>
          </p>
        </div>
        {/* Decorative clouds */}
        <div className="absolute top-8 right-8 w-16 h-5 bg-white/40 rounded-full blur-sm" />
        <div className="absolute top-16 right-16 w-10 h-4 bg-white/30 rounded-full blur-sm" />
        {/* Canvas */}
        <canvas ref={canvasRef} className="w-full flex-1" style={{ pointerEvents: 'none' }} />
        {/* Ground */}
        <div className="w-full h-10 bg-green-500 border-t-4 border-green-600 z-10 flex items-center justify-center">
          <div className="text-green-800 text-xs font-black uppercase tracking-widest">🌱 Nền móng</div>
        </div>
      </div>

      {/* Right: Question Panel */}
      <div className="w-full md:w-3/5 flex flex-col p-6 md:p-8 bg-slate-50 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-sky-600 uppercase">Tháp Trí Tuệ</h1>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Câu hỏi {currentIdx + 1} / {gameQuestions.length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Điểm tích lũy</p>
            <p className="text-3xl font-black text-orange-500">{score}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-200 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-sky-400 rounded-full transition-all duration-500"
            style={{ width: `${((currentIdx) / gameQuestions.length) * 100}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="flex-grow flex flex-col justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-slate-100">
            {/* Badge */}
            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-4 uppercase text-white ${q.type === 'TF' ? 'bg-blue-500' : 'bg-purple-600'}`}>
              {q.type === 'TF' ? '✅ Đúng hay Sai?' : '✏️ Trả lời ngắn'}
            </span>
            {/* Question text */}
            <div className="text-lg font-bold text-slate-800 mb-6 leading-relaxed text-center overflow-x-auto">
              <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {q.question}
              </Markdown>
            </div>

            {/* Input area */}
            {q.type === 'TF' ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => submit('Đúng')}
                  disabled={isAnswered}
                  className="bg-green-500 hover:bg-green-600 text-white font-black py-5 rounded-2xl text-lg shadow-lg active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider">
                  ✅ ĐÚNG
                </button>
                <button
                  onClick={() => submit('Sai')}
                  disabled={isAnswered}
                  className="bg-red-500 hover:bg-red-600 text-white font-black py-5 rounded-2xl text-lg shadow-lg active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider">
                  ❌ SAI
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nhập đáp án..."
                  className="w-full p-4 border-2 border-slate-300 rounded-xl outline-none text-lg font-bold text-slate-900 bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all shadow-inner text-center"
                  value={shortAns}
                  onChange={e => setShortAns(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submit(shortAns); }}
                  disabled={isAnswered}
                  autoFocus
                />
                <button
                  onClick={() => submit(shortAns)}
                  disabled={isAnswered || !shortAns.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider">
                  XÁC NHẬN ĐÁP ÁN
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Feedback */}
        <div className={`mt-4 h-12 flex items-center justify-center font-black text-xl transition-all duration-300 ${feedback ? 'opacity-100' : 'opacity-0'} ${feedback?.ok ? 'text-green-600' : 'text-red-500'}`}>
          {feedback?.text}
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        .shake-anim { animation: shake-kf 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake-kf {
          10%, 90% { transform: translate3d(-2px, 0, 0); }
          20%, 80% { transform: translate3d(4px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
          40%, 60% { transform: translate3d(6px, 0, 0); }
        }
      `}</style>
    </div>
  );
}
