import React, { useState, useEffect, useRef } from 'react';
import MathText from './MathText';
import { ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}

export interface QuestionItem {
  id: string;
  content: string;
  options?: string[];
  correctAnswer?: string;
  type: string;
  level: string;
}

interface Props {
  initialQuestions: QuestionItem[];
  onBack: () => void;
}

type ScreenState = 'start' | 'play' | 'end';

interface PairItem {
  id: string;
  content: string;
}

export default function CapDoiHoanHaoGame({ initialQuestions, onBack }: Props) {
  const [screen, setScreen] = useState<ScreenState>('start');
  const [leftItems, setLeftItems] = useState<PairItem[]>([]);
  const [rightItems, setRightItems] = useState<PairItem[]>([]);
  
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<{left: string, right: string} | null>(null);
  
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startGame = () => {
    const validQuestions = initialQuestions.filter(q => {
      let ans = q.correctAnswer || (q.options ? q.options[0] : '');
      return q.content && ans;
    });

    if (validQuestions.length < 2) {
      alert("Cần ít nhất 2 câu hỏi để chơi ghép nối.");
      return;
    }

    const pairs = validQuestions.map((q, i) => {
      let rightText = q.correctAnswer || (q.options ? q.options[0] : '');
      // If correctAnswer is a letter like A, B, C, D and options exist
      if (['A', 'B', 'C', 'D'].includes(rightText) && q.options) {
        const idx = ['A', 'B', 'C', 'D'].indexOf(rightText);
        if (idx >= 0 && q.options[idx]) rightText = q.options[idx];
      }
      return { id: `item-${i}`, left: q.content, right: rightText };
    });

    const lItems = pairs.map(p => ({ id: p.id, content: p.left })).sort(() => Math.random() - 0.5);
    const rItems = pairs.map(p => ({ id: p.id, content: p.right })).sort(() => Math.random() - 0.5);

    setLeftItems(lItems);
    setRightItems(rItems);
    setMatchedIds([]);
    setScore(0);
    setSeconds(0);
    setSelectedLeft(null);
    setWrongPair(null);
    setScreen('play');

    timerRef.current = window.setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
  };

  const handleLeftClick = (id: string) => {
    if (matchedIds.includes(id) || wrongPair) return;
    setSelectedLeft(id);
  };

  const handleRightClick = (id: string) => {
    if (matchedIds.includes(id) || wrongPair) return;
    if (!selectedLeft) return;

    if (selectedLeft === id) {
      // Match correct!
      setScore(s => s + 100);
      setMatchedIds(prev => {
        const next = [...prev, id];
        if (next.length === leftItems.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeout(() => setScreen('end'), 800);
        }
        return next;
      });
      setSelectedLeft(null);
    } else {
      // Match incorrect!
      setScore(s => Math.max(0, s - 20));
      setWrongPair({ left: selectedLeft, right: id });
      setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
      }, 600);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (screen === 'start') {
    return (
      <div className="w-full min-h-[600px] flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-[2rem] text-slate-50 relative overflow-hidden font-sans">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, #06b6d4 0%, transparent 50%), radial-gradient(circle at 0% 100%, #10b981 0%, transparent 50%)' }} />
        
        <div className="text-center z-10 max-w-2xl px-6">
          <div className="text-6xl mb-6">🔗</div>
          <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 tracking-tighter uppercase mb-4 drop-shadow-lg">
            Cặp Đôi Hoàn Hảo
          </h1>
          <p className="text-lg md:text-xl text-slate-300 font-medium mb-10 leading-relaxed shadow-sm">
            Nối chính xác nội dung giữa Cột A và Cột B
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button onClick={onBack} className="bg-white/10 hover:bg-white/20 px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-2">
              <ChevronLeft size={20} /> Quay Lại
            </button>
            <button onClick={startGame} className="bg-gradient-to-r from-teal-400 to-cyan-500 hover:scale-105 text-slate-900 px-10 py-4 rounded-2xl font-black text-xl transition-all shadow-[0_0_30px_rgba(45,212,191,0.4)]">
              Bắt Đầu Ghép Nối
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'end') {
    return (
      <div className="w-full min-h-[600px] flex items-center justify-center bg-[#0f172a] rounded-[2rem] text-slate-50 relative overflow-hidden">
        <div className="text-center z-10 p-8">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-4xl md:text-5xl font-black text-yellow-400 mb-6 drop-shadow-xl uppercase">TUYỆT VỜI!</h2>
            <div className="bg-slate-800/80 backdrop-blur-md border border-white/10 rounded-3xl p-8 mb-8 inline-block shadow-2xl">
              <div className="grid grid-cols-2 gap-8 text-center px-4">
                <div>
                  <div className="text-slate-400 text-xs uppercase font-black tracking-widest mb-1">Điểm Số</div>
                  <div className="text-5xl font-black text-teal-400">{score}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs uppercase font-black tracking-widest mb-1">Thời Gian</div>
                  <div className="text-5xl font-black text-cyan-400">{formatTime(seconds)}</div>
                </div>
              </div>
            </div>
          </motion.div>
          
          <div className="flex justify-center gap-4">
            <button onClick={startGame} className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-8 py-3 rounded-xl font-bold transition-all">Chơi Mới</button>
            <button onClick={onBack} className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-bold transition-all">Đổi Trò Chơi</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[600px] bg-[#0f172a] rounded-[2rem] text-white flex flex-col items-center p-4 sm:p-8 font-sans relative">
      <div className="w-full max-w-5xl flex justify-between items-center bg-slate-800/60 p-4 rounded-2xl border border-white/10 shadow-lg mb-8">
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 uppercase tracking-tight hidden sm:block">
          Cặp Đôi Hoàn Hảo
        </h2>
        <div className="flex gap-4 sm:gap-8">
          <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-xl border border-teal-500/30">
            <span className="text-teal-400 text-xl">⭐</span>
            <span className="font-black font-mono text-xl">{score}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-2 rounded-xl border border-cyan-500/30">
            <span className="text-cyan-400 text-xl">⏱️</span>
            <span className="font-black font-mono text-xl">{formatTime(seconds)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-12 w-full max-w-5xl flex-1 mb-8">
        {/* Cột A */}
        <div className="flex flex-col gap-4">
          <h3 className="text-center font-black text-teal-400 uppercase tracking-widest mb-2 text-xl">Cột A</h3>
          {leftItems.map((item) => {
            const isMatched = matchedIds.includes(item.id);
            const isSelected = selectedLeft === item.id;
            const isWrong = wrongPair?.left === item.id;

            return (
              <motion.div
                key={item.id}
                animate={isWrong ? { x: [-5, 5, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                onClick={() => handleLeftClick(item.id)}
                className={cn(
                  "p-5 rounded-2xl border flex items-center flex-col justify-center min-h-[100px] text-center font-bold text-[1.1rem] transition-all cursor-pointer shadow-lg",
                  isMatched ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 opacity-50 scale-95 pointer-events-none" :
                  isSelected ? "bg-teal-500 border-teal-400 text-slate-900 scale-105 shadow-[0_0_20px_rgba(45,212,191,0.5)] z-10" :
                  isWrong ? "bg-red-500/80 border-red-400 text-white" :
                  "bg-slate-800 border-white/10 hover:bg-slate-700 hover:border-teal-500/50 hover:-translate-y-1"
                )}
              >
                <MathText>{item.content}</MathText>
              </motion.div>
            );
          })}
        </div>

        {/* Cột B */}
        <div className="flex flex-col gap-4">
          <h3 className="text-center font-black text-cyan-400 uppercase tracking-widest mb-2 text-xl">Cột B</h3>
          {rightItems.map((item) => {
            const isMatched = matchedIds.includes(item.id);
            const isWrong = wrongPair?.right === item.id;

            return (
              <motion.div
                key={item.id}
                animate={isWrong ? { x: [-5, 5, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                onClick={() => handleRightClick(item.id)}
                className={cn(
                  "p-5 rounded-2xl border flex items-center flex-col justify-center min-h-[100px] text-center font-bold text-[1.1rem] transition-all cursor-pointer shadow-lg",
                  isMatched ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 opacity-50 scale-95 pointer-events-none" :
                  isWrong ? "bg-red-500/80 border-red-400 text-white" :
                  "bg-slate-800 border-white/10 hover:bg-slate-700 hover:border-cyan-500/50 hover:-translate-y-1"
                )}
              >
                <MathText>{item.content}</MathText>
              </motion.div>
            );
          })}
        </div>
      </div>

      <button onClick={onBack} className="mt-auto px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex items-center gap-2 transition-all">
        <ChevronLeft size={18} /> Đổi trò chơi
      </button>
    </div>
  );
}
