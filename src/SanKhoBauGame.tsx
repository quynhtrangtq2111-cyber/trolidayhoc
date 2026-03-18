import React, { useState, useEffect, useRef, useMemo } from 'react';
import MathText from './MathText';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface QuestionItem {
  id: string; content: string; options?: string[];
  correctAnswer?: string; type: string; level: string;
}
interface Props { initialQuestions: QuestionItem[]; onBack: () => void; }

export default function SanKhoBauGame({ initialQuestions, onBack }: Props) {
  const [screen, setScreen] = useState<'start' | 'game' | 'end'>('start');
  const [playerName, setPlayerName] = useState('');
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(0);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [answered, setAnswered] = useState(false);
  const [filledSlots, setFilledSlots] = useState<string[]>([]);
  const [shortAns, setShortAns] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (screen === 'game') {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const q = initialQuestions[idx];

  // Shuffled words for fill-blank — only recompute when question changes
  const shuffledWords = useMemo(() => {
    if (!q) return [];
    const answers = q.correctAnswer ? [q.correctAnswer] : [];
    const distractors = (q.options || []).filter(o => o !== q.correctAnswer);
    return [...answers, ...distractors].sort(() => Math.random() - 0.5);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setFilledSlots([]); setShortAns(''); }, [idx]);

  const answer = (selected: string) => {
    if (answered) return;
    setAnswered(true);
    // selected could be a letter (A/B/C/D) for MCQ or full text for short-answer
    let ok: boolean;
    const letters = ['A', 'B', 'C', 'D'];
    const ca = (q.correctAnswer || '').trim();
    if (q.options && q.options.length > 0 && letters.includes(ca)) {
      // MCQ mode: selected is the letter
      ok = selected === ca;
      const correctText = q.options[letters.indexOf(ca)] || ca;
      setFeedback(ok
        ? { msg: '\u2705 Ch\u00ednh x\u00e1c! +10 v\u00e0ng', ok: true }
        : { msg: `\u274c Sai r\u1ed3i! \u0110\u00e1p \u00e1n: ${correctText}`, ok: false });
    } else {
      // Short-answer mode: selected is the text
      ok = selected.trim().toLowerCase() === ca.trim().toLowerCase();
      setFeedback(ok
        ? { msg: '\u2705 Ch\u00ednh x\u00e1c! +10 v\u00e0ng', ok: true }
        : { msg: `\u274c Sai r\u1ed3i! \u0110\u00e1p \u00e1n: ${ca}`, ok: false });
    }
    if (ok) setScore(s => s + 10);
  };

  const next = () => {
    setFeedback(null); setAnswered(false);
    if (idx + 1 < initialQuestions.length) setIdx(i => i + 1);
    else setScreen('end');
  };

  const checkFill = () => {
    const answers = q.correctAnswer ? [q.correctAnswer] : [];
    const ok = answers.every((a, i) =>
      (filledSlots[i] || '').trim().toLowerCase() === a.trim().toLowerCase());
    setAnswered(true);
    setFeedback(ok
      ? { msg: '✅ Tuyệt vời! +10 vàng', ok: true }
      : { msg: `❌ Chưa đúng! Đáp án: ${answers.join(', ')}`, ok: false });
    if (ok) setScore(s => s + 10);
  };

  const resetGame = () => {
    setScreen('start'); setIdx(0); setScore(0); setTimer(0);
    setAnswered(false); setFeedback(null); setFilledSlots([]); setShortAns('');
  };

  // ── SCREENS ──────────────────────────────────────────────────────
  if (screen === 'start') return (
    <div className="min-h-[560px] bg-gradient-to-br from-[#1a2a6c] to-[#2a4858] rounded-3xl p-8 flex flex-col items-center justify-center text-white">
      <button onClick={onBack} className="self-start px-4 py-2 bg-white/10 rounded-xl text-sm mb-6 hover:bg-white/20">← Đổi Game</button>
      <div className="text-6xl mb-4">🗺️</div>
      <h1 className="text-4xl font-black text-amber-400 text-center mb-2 uppercase">Săn Kho Báu Tri Thức</h1>
      <p className="text-amber-200 mb-8">Trả lời đúng để thu thập vàng!</p>
      <input type="text" placeholder="Nhập tên học sinh..." maxLength={20}
        value={playerName} onChange={e => setPlayerName(e.target.value)}
        className="w-full max-w-xs px-4 py-3 rounded-xl text-slate-900 font-semibold text-center mb-4 outline-none" />
      <button onClick={() => { if (playerName.trim()) setScreen('game'); }}
        disabled={!playerName.trim()}
        className="px-8 py-3 bg-amber-500 text-slate-900 rounded-xl font-black text-lg hover:bg-amber-400 disabled:opacity-50 transition-all">
        Bắt đầu hành trình! 🚢
      </button>
      <p className="mt-4 text-amber-200/60 text-sm">{initialQuestions.length} câu hỏi · Trả lời đúng +10 vàng</p>
    </div>
  );

  if (screen === 'end') {
    const total = initialQuestions.length * 10;
    const pct = Math.round((score / total) * 100);
    return (
      <div className="min-h-[560px] bg-gradient-to-br from-[#1a2a6c] to-[#2a4858] rounded-3xl p-8 flex flex-col items-center justify-center text-white">
        <div className="text-6xl mb-4">{pct >= 80 ? '🏆' : pct >= 50 ? '🥈' : '🗺️'}</div>
        <h2 className="text-3xl font-black text-amber-400 mb-2">Hành trình kết thúc!</h2>
        <p className="text-amber-200 mb-6">Chúc mừng <strong>{playerName}</strong>!</p>
        <div className="bg-white/10 rounded-2xl p-6 text-center mb-6 w-full max-w-xs">
          <div className="text-5xl font-black text-amber-400">{score}</div>
          <div className="text-amber-200 text-sm mt-1">{score}/{total} điểm · {fmt(timer)}</div>
        </div>
        <div className="flex gap-4">
          <button onClick={resetGame} className="px-6 py-3 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400">Chơi lại</button>
          <button onClick={onBack} className="px-6 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20">Đổi Game</button>
        </div>
      </div>
    );
  }

  // ── GAME SCREEN ───────────────────────────────────────────────────
  if (!q) return null;
  const hasMCQ = q.options && q.options.length > 0;
  const parts = q.content.split(/_{2,}|\(___\)/);
  const hasBlanks = parts.length > 1;

  return (
    <div className="min-h-[560px] bg-gradient-to-br from-[#1a2a6c] to-[#2a4858] rounded-3xl overflow-hidden text-white">
      {/* Header */}
      <div className="bg-amber-900/80 px-6 py-4 flex justify-between items-center">
        <span className="font-bold">👤 {playerName}</span>
        <span className="font-bold text-amber-300">Câu {idx + 1}/{initialQuestions.length}</span>
        <span>💰 {score} · ⏱️ {fmt(timer)}</span>
      </div>

      <div className="p-8 flex flex-col items-center gap-6">
        {/* Question card */}
        <div className="w-full max-w-2xl bg-white/10 rounded-2xl p-6 text-center">
          <span className="text-xs bg-amber-500 text-slate-900 px-3 py-1 rounded-full font-bold mb-3 inline-block">
            {q.type} · {q.level}
          </span>
          {!hasBlanks && <MathText className="text-xl font-bold leading-relaxed mt-2 text-center">{q.content}</MathText>}
        </div>

        {/* Fill-blank drag-drop */}
        {hasBlanks && !hasMCQ && (
          <div className="w-full max-w-2xl space-y-4">
            <div className="text-xl font-bold text-center leading-loose">
              {parts.map((part, i) => (
                <React.Fragment key={i}>
                  <span>{part}</span>
                  {i < parts.length - 1 && (
                    <span
                      className={cn(
                        'inline-block mx-2 min-w-[80px] px-3 py-1 border-b-4 border-amber-500 bg-white/10 rounded text-center cursor-default',
                        filledSlots[i] ? 'text-amber-300 font-bold' : 'text-white/40'
                      )}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const w = e.dataTransfer.getData('text');
                        setFilledSlots(prev => { const n = [...prev]; n[i] = w; return n; });
                      }}
                    >{filledSlots[i] || '___'}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {shuffledWords.map((w, i) => (
                <div key={i} draggable onDragStart={e => e.dataTransfer.setData('text', w)}
                  className="px-4 py-2 bg-white border-2 border-amber-700 rounded-xl cursor-grab font-bold text-slate-900 shadow hover:scale-105 transition-transform select-none">
                  {w}
                </div>
              ))}
            </div>
            {!answered && (
              <button onClick={checkFill}
                className="w-full py-3 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400">
                Kiểm tra
              </button>
            )}
          </div>
        )}

        {/* MCQ */}
        {hasMCQ && (
          <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
          {q.options!.map((opt, i) => {
              const letter = ['A', 'B', 'C', 'D'][i];
              const isCorrect = letter === (q.correctAnswer || '').trim().toUpperCase();
              return (
                <button key={i} onClick={() => answer(letter)} disabled={answered}
                  className={cn(
                    'p-4 rounded-2xl font-bold text-left flex items-center gap-3 transition-all',
                    !answered ? 'bg-white/10 hover:bg-amber-500 hover:text-slate-900 cursor-pointer' :
                    isCorrect ? 'bg-green-500 text-white' : 'bg-white/5 text-white/40'
                  )}>
                  <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center text-sm font-black shrink-0">
                    {letter}
                  </span>
                  <MathText inline className="flex-1">{opt}</MathText>
                </button>
              );
            })}
          </div>
        )}

        {/* Short answer */}
        {!hasMCQ && !hasBlanks && (
          <div className="w-full max-w-2xl space-y-3">
            <input type="text" value={shortAns} onChange={e => setShortAns(e.target.value)}
              placeholder="Nhập câu trả lời..." disabled={answered}
              onKeyDown={e => { if (e.key === 'Enter' && shortAns.trim()) answer(shortAns); }}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border-2 border-amber-500/50 text-white text-center text-lg outline-none focus:border-amber-400" />
            {!answered && (
              <button onClick={() => { if (shortAns.trim()) answer(shortAns); }}
                className="w-full py-3 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400">
                Kiểm tra
              </button>
            )}
          </div>
        )}

        {feedback && (
          <div className={cn('px-6 py-3 rounded-xl font-bold text-lg', feedback.ok ? 'bg-green-500' : 'bg-red-500')}>
            {feedback.msg}
          </div>
        )}

        {answered && (
          <button onClick={next}
            className="px-8 py-3 bg-amber-500 text-slate-900 rounded-xl font-black text-lg hover:bg-amber-400 transition-all">
            {idx + 1 < initialQuestions.length ? 'Tiếp theo ➔' : '🏁 Xem kết quả'}
          </button>
        )}
      </div>
    </div>
  );
}
