import React, { useState, useEffect, useRef } from 'react';
import MathText from './MathText';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface QuestionItem {
  id: string; content: string; options?: string[];
  correctAnswer?: string; type: string; level: string;
}
interface Props { initialQuestions: QuestionItem[]; onBack: () => void; }

const TOTAL_TILES = 100;
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1000';

export default function BucTranhBiAnGame({ initialQuestions, onBack }: Props) {
  const [screen, setScreen] = useState<'start' | 'game' | 'end'>('start');
  const [playerName, setPlayerName] = useState('');
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMG);

  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(0);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [answered, setAnswered] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [shortAns, setShortAns] = useState('');
  const [hiddenTiles, setHiddenTiles] = useState<boolean[]>(Array(TOTAL_TILES).fill(true));
  const tileOrderRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    if (screen === 'game') {
      tileOrderRef.current = Array.from({ length: TOTAL_TILES }, (_, i) => i)
        .sort(() => Math.random() - 0.5);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  const q = initialQuestions[idx];

  const revealTiles = (count: number) => {
    const indices = tileOrderRef.current.splice(0, count);
    setHiddenTiles(prev => {
      const next = [...prev];
      indices.forEach(i => { next[i] = false; });
      return next;
    });
  };

  const handleCheck = () => {
    if (answered) return;
    const letters = ['A', 'B', 'C', 'D'];
    const ca = (q.correctAnswer || '').trim();

    const hasMCQ2 = q.options && q.options.length > 0;

    if (hasMCQ2) {
      // MCQ path — selectedOpt stores the letter clicked
      const val = (selectedOpt || '').trim();
      if (!val) return; // nothing selected yet

      let isOk: boolean;
      let correctDisplay: string;

      if (letters.includes(ca)) {
        // correctAnswer is a letter like "A"
        isOk = val === ca;
        correctDisplay = q.options![letters.indexOf(ca)] ?? ca;
      } else {
        // correctAnswer is the text content like "Đúng"/"Sai"
        // find which letter corresponds
        const correctIdx = q.options!.findIndex(
          o => o.trim().toLowerCase() === ca.toLowerCase()
        );
        const correctLetter = correctIdx >= 0 ? letters[correctIdx] : '';
        isOk = correctLetter ? (val === correctLetter) : (val === ca);
        correctDisplay = q.options![correctIdx] ?? ca;
      }

      setAnswered(true);
      setFeedback(isOk
        ? { msg: '✅ Chính xác! +10 điểm', ok: true }
        : { msg: `❌ Chưa đúng! Đáp án: ${correctDisplay}`, ok: false });
      if (isOk) {
        setScore(s => s + 10);
        revealTiles(Math.ceil(TOTAL_TILES / initialQuestions.length));
      }
    } else {
      // Short-answer path
      const val = shortAns.trim();
      if (!val) return;

      const isOk = val.toLowerCase() === ca.toLowerCase();
      setAnswered(true);
      setFeedback(isOk
        ? { msg: '✅ Chính xác! +10 điểm', ok: true }
        : { msg: `❌ Chưa đúng! Đáp án: ${ca}`, ok: false });
      if (isOk) {
        setScore(s => s + 10);
        revealTiles(Math.ceil(TOTAL_TILES / initialQuestions.length));
      }
    }

    setTimeout(() => {
      setFeedback(null); setAnswered(false); setSelectedOpt(null); setShortAns('');
      if (idx + 1 < initialQuestions.length) {
        setIdx(i => i + 1);
      } else {
        setHiddenTiles(Array(TOTAL_TILES).fill(false));
        setScreen('end');
      }
    }, 1800);
  };


  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setImageUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetGame = () => {
    setScreen('start'); setIdx(0); setScore(0); setTimer(0);
    setAnswered(false); setFeedback(null); setSelectedOpt(null); setShortAns('');
    setHiddenTiles(Array(TOTAL_TILES).fill(true));
  };

  // ── START SCREEN ──────────────────────────────────────────────────
  if (screen === 'start') return (
    <div className="min-h-[560px] bg-[#0f172a] rounded-3xl p-8 flex flex-col items-center justify-center text-white">
      <button onClick={onBack} className="self-start px-4 py-2 bg-white/10 rounded-xl text-sm mb-6 hover:bg-white/20">← Đổi Game</button>
      <div className="text-5xl mb-4">🖼️</div>
      <h1 className="text-4xl font-black text-center mb-1 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 uppercase tracking-tight">
        Bức Tranh Bí Ẩn
      </h1>
      <p className="text-slate-400 mb-8 text-center">Trả lời đúng để lộ ra bức tranh ẩn bí!</p>
      <div className="w-full max-w-sm space-y-4">
        <input type="text" placeholder="Họ và tên học sinh..."
          value={playerName} onChange={e => setPlayerName(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center outline-none focus:border-yellow-500" />
        <div>
          <p className="text-xs text-slate-500 mb-2 text-center">Chọn hình ảnh bí ẩn (tuỳ chọn)</p>
          <input type="file" accept="image/*" onChange={handleImageFile}
            className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-yellow-500 file:text-slate-900 file:font-bold cursor-pointer" />
        </div>
        <img src={imageUrl} alt="preview" className="w-full h-28 object-cover rounded-xl opacity-40 blur-sm" />
        <button onClick={() => { if (playerName.trim()) setScreen('game'); }}
          disabled={!playerName.trim()}
          className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-400 text-slate-900 rounded-xl font-black text-lg hover:scale-105 disabled:opacity-50 transition-all">
          Vào Chơi Ngay! 🎮
        </button>
      </div>
      <p className="mt-4 text-slate-600 text-xs">{initialQuestions.length} câu · Đúng → mở ô ảnh</p>
    </div>
  );

  // ── END SCREEN ────────────────────────────────────────────────────
  if (screen === 'end') return (
    <div className="min-h-[560px] bg-[#0f172a] rounded-3xl p-8 flex flex-col items-center justify-center text-white">
      <div className="text-6xl mb-4">🏆</div>
      <h2 className="text-3xl font-black text-yellow-400 mb-2">Hoàn thành thử thách!</h2>
      <p className="text-slate-300 mb-6">Chúc mừng <strong>{playerName}</strong>!</p>
      <div className="grid grid-cols-2 gap-4 mb-6 w-full max-w-xs">
        <div className="bg-slate-800 p-4 rounded-xl text-center">
          <p className="text-slate-400 text-xs uppercase mb-1">Điểm số</p>
          <p className="text-4xl font-black text-yellow-400">{score}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl text-center">
          <p className="text-slate-400 text-xs uppercase mb-1">Thời gian</p>
          <p className="text-4xl font-black text-blue-400">{fmt(timer)}</p>
        </div>
      </div>
      <div className="w-full max-w-xs rounded-2xl overflow-hidden mb-6 border-2 border-yellow-500/50 shadow-xl">
        <img src={imageUrl} alt="revealed" className="w-full object-cover" />
      </div>
      <div className="flex gap-4">
        <button onClick={resetGame} className="px-6 py-3 bg-yellow-500 text-slate-900 rounded-xl font-bold hover:bg-yellow-400">Chơi lại</button>
        <button onClick={onBack} className="px-6 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20">Đổi Game</button>
      </div>
    </div>
  );

  // ── GAME SCREEN ───────────────────────────────────────────────────
  if (!q) return null;
  const hasMCQ = q.options && q.options.length > 0;

  return (
    <div className="min-h-[560px] bg-[#0f172a] rounded-3xl overflow-hidden text-white">
      <div className="flex flex-col md:flex-row" style={{ minHeight: '560px' }}>
        {/* Left: Question */}
        <div className="w-full md:w-2/5 p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center text-sm">
            <span className="px-3 py-1 bg-yellow-500 text-slate-900 text-xs font-bold rounded-full">
              Câu {idx + 1}/{initialQuestions.length}
            </span>
            <span className="text-yellow-400 font-bold">⏱️ {fmt(timer)}</span>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-5 flex flex-col gap-4 flex-1">
             <MathText className="text-base font-bold leading-tight text-white">{q.content}</MathText>

            {hasMCQ ? (
              <div className="flex flex-col gap-2">
                {q.options!.map((opt, i) => {
                  const letter = ['A', 'B', 'C', 'D'][i];
                  return (
                  <button key={i} disabled={answered}
                    onClick={() => setSelectedOpt(letter)}
                    className={cn(
                      'p-3 rounded-xl border-2 text-left flex items-center gap-3 text-sm font-medium transition-all',
                      selectedOpt === letter
                        ? 'border-yellow-500 bg-yellow-500/10 text-yellow-200'
                        : 'border-slate-700 bg-slate-800 hover:border-yellow-500/40'
                    )}>
                     <span className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-black shrink-0 text-yellow-400">
                       {letter}
                     </span>
                     <MathText inline className="flex-1 text-sm">{opt}</MathText>
                  </button>
                  );
                })}
              </div>
            ) : (
              <input type="text" value={shortAns} onChange={e => setShortAns(e.target.value)}
                disabled={answered}
                placeholder="Nhập câu trả lời..."
                onKeyDown={e => { if (e.key === 'Enter') handleCheck(); }}
                className="w-full p-4 bg-slate-700 border-2 border-slate-600 rounded-xl outline-none focus:border-yellow-500 text-center" />
            )}

            {feedback && (
              <div className={cn('p-3 rounded-xl font-bold text-center text-sm',
                feedback.ok ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30')}>
                {feedback.msg}
              </div>
            )}

            {!answered && (
              <button onClick={handleCheck}
                className="w-full py-3 bg-yellow-500 text-slate-900 font-black rounded-xl hover:bg-yellow-400 transition-all mt-auto">
                KIỂM TRA
              </button>
            )}
          </div>

          <div className="text-center text-xs text-slate-600">💰 Điểm: {score} · 👤 {playerName}</div>
        </div>

        {/* Right: Tile image */}
        <div className="w-full md:w-3/5 p-4 flex items-center justify-center bg-slate-900/40">
          <div className="relative w-full rounded-2xl overflow-hidden border-2 border-yellow-500/20 shadow-2xl"
            style={{ aspectRatio: '16/9' }}>
            <img src={imageUrl} alt="secret" className="w-full h-full object-cover" />
            <div className="absolute inset-0 grid grid-cols-10">
              {hiddenTiles.map((hidden, i) => (
                <div key={i} className={cn(
                  'border-[0.5px] border-slate-900/40 transition-all duration-500',
                  hidden ? 'bg-slate-900' : 'opacity-0 pointer-events-none'
                )} />
              ))}
            </div>
            {/* Tile count overlay */}
            <div className="absolute bottom-3 right-3 bg-black/70 px-3 py-1 rounded-full text-xs text-yellow-400 font-bold">
              🔓 {hiddenTiles.filter(h => !h).length}/{TOTAL_TILES}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
