import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface QuestionItem {
  id: string;
  content: string;
  options: string[];
  correctAnswer: string;
  type: string;
  level: string;
}

interface VuotAiTriThucProps {
  initialQuestions: QuestionItem[];
  onBack: () => void;
}

export default function VuotAiTriThucGame({ initialQuestions, onBack }: VuotAiTriThucProps) {
  const [screen, setScreen] = useState<'home' | 'play' | 'result'>('home');
  const [questions, setQuestions] = useState<QuestionItem[]>(initialQuestions);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [totalTime, setTotalTime] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  
  const timerRef = useRef<number | null>(null);

  const gameCfg = { time: 30, points: 10 };

  const playSound = (type: 'correct' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = audioCtx.createOscillator(); 
      const g = audioCtx.createGain();
      o.connect(g); 
      g.connect(audioCtx.destination);
      if (type === 'correct') { 
        o.frequency.setValueAtTime(523, audioCtx.currentTime); 
        o.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime+0.1); 
        g.gain.setValueAtTime(0.1, audioCtx.currentTime); 
      } else { 
        o.type = 'square'; 
        o.frequency.setValueAtTime(150, audioCtx.currentTime); 
        g.gain.setValueAtTime(0.1, audioCtx.currentTime); 
      }
      o.start(); 
      o.stop(audioCtx.currentTime+0.2);
    } catch(e) {}
  };

  const startGame = () => {
    if (questions.length === 0) {
      alert("Chưa có câu hỏi!");
      return;
    }
    setScore(0);
    setCorrectCount(0);
    setCurrentIdx(0);
    setTotalTime(0);
    setScreen('play');
    loadQuestion(0);
  };

  const loadQuestion = (idx: number) => {
    setCurrentIdx(idx);
    setShowAnswer(false);
    setSelectedOpt(null);
    startTimer();
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(gameCfg.time);
    
    timerRef.current = window.setInterval(() => {
      setTotalTime(t => t + 1);
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeOut = () => {
    setShowAnswer(true);
    playSound('error');
    setTimeout(nextQuestion, 2000);
  };

  const checkAnswer = (choice: string) => {
    if (showAnswer) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    setShowAnswer(true);
    setSelectedOpt(choice);

    const q = questions[currentIdx];
    if (choice === q.correctAnswer) {
      setScore(s => s + gameCfg.points);
      setCorrectCount(c => c + 1);
      playSound('correct');
    } else {
      playSound('error');
    }
    
    setTimeout(nextQuestion, 2000);
  };

  const nextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      loadQuestion(currentIdx + 1);
    } else {
      setScreen('result');
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (screen === 'home') {
    return (
      <div className="w-full h-full min-h-[600px] flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-4 rounded-[2rem] text-slate-50 font-sans">
        <div className="text-center space-y-12 py-10 max-w-2xl w-full">
            <div>
                <h1 className="text-5xl md:text-7xl font-black text-yellow-400 italic uppercase drop-shadow-2xl tracking-tighter mb-4">VƯỢT ẢI TRI THỨC</h1>
                <p className="text-xl md:text-2xl text-slate-300 font-medium">Hệ thống ôn tập chuyên sâu</p>
                <div className="mt-4 inline-block bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700 text-sm">
                  Đã tải: <span className="font-bold text-emerald-400">{questions.length}</span> câu hỏi
                </div>
            </div>
            <div className="flex flex-col md:flex-row gap-6 justify-center">
                <button 
                  onClick={onBack} 
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-10 rounded-full border border-slate-600 transition-colors"
                >
                  <ChevronLeft className="inline-block mr-2" size={20} /> QUAY LẠI
                </button>
                <button 
                  onClick={startGame} 
                  className="bg-gradient-to-br from-yellow-400 to-amber-600 hover:from-yellow-300 hover:to-amber-500 text-black py-4 px-12 rounded-full text-2xl md:text-3xl font-black shadow-2xl transition-transform hover:scale-105"
                >
                  BẮT ĐẦU CHƠI
                </button>
            </div>
        </div>
      </div>
    );
  }

  if (screen === 'play') {
    const q = questions[currentIdx];
    const timerPerc = (timeLeft / gameCfg.time) * 100;

    return (
      <div className="w-full h-full min-h-[600px] bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-[2rem] text-slate-50 font-sans flex flex-col p-4 md:p-8">
        <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col space-y-6">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-800/50 backdrop-blur-md px-6 py-4 rounded-3xl border-b-4 border-black/20 shadow-2xl gap-4">
                <div>
                    <span className="font-black text-yellow-400 text-xl tracking-tighter uppercase italic">Vòng 1: Trắc nghiệm</span>
                </div>
                <div className="text-center px-8 sm:border-x border-white/10 shrink-0">
                    <div className="text-[10px] uppercase font-black opacity-40 mb-1">Điểm số</div>
                    <div className="text-4xl font-black text-emerald-400 leading-none">{score}</div>
                </div>
                <div className="text-right">
                    <div className="font-black text-sky-400 text-xl italic">{currentIdx + 1}/{questions.length}</div>
                </div>
            </div>

            {/* Timer */}
            <div className="space-y-2 px-2">
                <div className="flex justify-between text-xs font-black uppercase opacity-60">
                    <span>Thời gian</span><span className="text-yellow-400">{timeLeft}s</span>
                </div>
                <div className="h-3 bg-black/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-400 transition-all duration-1000 ease-linear"
                    style={{ width: `${timerPerc}%` }}
                  />
                </div>
            </div>

            {/* Question Content */}
            <div className="bg-slate-800/60 backdrop-blur-xl p-8 rounded-3xl text-center min-h-[200px] flex flex-col justify-center shadow-2xl border border-white/10">
                <div className="text-2xl md:text-3xl font-bold leading-relaxed">
                  <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {q.content}
                  </Markdown>
                </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
              {q.options.map((opt, idx) => {
                const letter = ['A', 'B', 'C', 'D'][idx];
                let btnClass = "bg-white/5 border-white/10 hover:bg-white/10";

                // Map correctAnswer text -> letter for highlighting
                const lettersDict = ['A', 'B', 'C', 'D'];
                let correctLts = q.correctAnswer; 
                if (!lettersDict.includes(q.correctAnswer)) {
                    // correctAnswer is text (e.g. "Đúng", "Sai")
                    const correctIdx = q.options.findIndex(o => o.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase());
                    if (correctIdx >= 0) correctLts = lettersDict[correctIdx];
                }

                if (showAnswer) {
                  if (letter === correctLts) {
                    btnClass = "bg-emerald-500 border-white shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-[1.02] z-10";
                  } else if (letter === selectedOpt) {
                    btnClass = "bg-red-500 border-white opacity-90";
                  } else {
                    btnClass = "bg-black/20 border-transparent opacity-40";
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => {
                       // Pass logic: treat choice as correct if it matches either letter OR text corresponding to letter
                       const choiceIsCorrect = letter === correctLts;
                       
                       if (showAnswer) return;
                       if (timerRef.current) clearInterval(timerRef.current);
                       setShowAnswer(true);
                       setSelectedOpt(letter);

                       if (choiceIsCorrect) {
                         setScore(s => s + gameCfg.points);
                         setCorrectCount(c => c + 1);
                         playSound('correct');
                       } else {
                         playSound('error');
                       }
                       setTimeout(nextQuestion, 2000);
                    }}
                    disabled={showAnswer}
                    className={cn(
                      "p-6 rounded-2xl border-2 text-left transition-all duration-300 flex items-center shadow-lg",
                      btnClass
                    )}
                  >
                    <span className="bg-yellow-400 text-black w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full mr-4 font-black text-lg">
                      {letter}
                    </span>
                    <span className="text-lg font-medium">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {opt}
                      </Markdown>
                    </span>
                  </button>
                );
              })}
            </div>

        </div>
      </div>
    );
  }

  // Result Screen
  const accuracy = Math.round((correctCount / questions.length) * 100) || 0;
  
  return (
    <div className="w-full h-full min-h-[600px] flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-4 rounded-[2rem] text-slate-50 font-sans">
        <div className="text-center bg-slate-800/50 backdrop-blur-xl p-10 md:p-16 rounded-[3rem] shadow-2xl border border-white/10 max-w-4xl w-full">
            <h2 className="text-5xl md:text-6xl font-black text-yellow-400 mb-12 italic uppercase drop-shadow-2xl">KẾT QUẢ</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                    <div className="text-xs opacity-40 mb-2 uppercase font-black">Điểm</div>
                    <div className="text-4xl md:text-5xl font-black text-emerald-400">{score}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                    <div className="text-xs opacity-40 mb-2 uppercase font-black">Đúng</div>
                    <div className="text-4xl md:text-5xl font-black text-white">{correctCount}/{questions.length}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                    <div className="text-xs opacity-40 mb-2 uppercase font-black">Thời gian</div>
                    <div className="text-4xl md:text-5xl font-black text-orange-400">{totalTime}s</div>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                    <div className="text-xs opacity-40 mb-2 uppercase font-black">Tỉ lệ</div>
                    <div className="text-4xl md:text-5xl font-black text-sky-400">{accuracy}%</div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={onBack} 
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-5 px-10 rounded-full transition-colors text-lg"
              >
                 VỀ ỨNG DỤNG
              </button>
              <button 
                onClick={startGame} 
                className="bg-gradient-to-br from-yellow-400 to-amber-600 hover:from-yellow-300 hover:to-amber-500 text-black py-5 px-16 rounded-full text-2xl font-black shadow-2xl italic hover:scale-105 transition-transform"
              >
                  CHƠI LẠI
              </button>
            </div>
        </div>
    </div>
  );
}
