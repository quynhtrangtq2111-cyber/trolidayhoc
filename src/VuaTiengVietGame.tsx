import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Play, Save, ChevronRight, CheckCircle2 } from 'lucide-react';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface ScrambleQuestion {
  text: string;
  answer: string;
  scrambled: string;
  image?: string | null;
}

interface VuaTiengVietProps {
  initialQuestions: ScrambleQuestion[];
  onBack: () => void;
}

export default function VuaTiengVietGame({ initialQuestions, onBack }: VuaTiengVietProps) {
  const [screen, setScreen] = useState<'home' | 'rules' | 'play' | 'result'>('home');
  const [questions, setQuestions] = useState<ScrambleQuestion[]>(initialQuestions);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [studentName, setStudentName] = useState('Học sinh');
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load tone generator
  const playTone = (freq: number, type: OscillatorType, duration: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  };

  const sounds = {
    correct: () => { playTone(523, 'sine', 0.2); setTimeout(() => playTone(659, 'sine', 0.3), 100); },
    wrong: () => playTone(220, 'square', 0.3),
    tick: () => playTone(800, 'sine', 0.05),
    complete: () => { playTone(440, 'sine', 0.2); setTimeout(() => playTone(554, 'sine', 0.2), 150); setTimeout(() => playTone(659, 'sine', 0.5), 300); }
  };

  const startGame = () => {
    setScreen('play');
    setCurrentIdx(0);
    setScore(0);
    loadQuestion(0);
  };

  const loadQuestion = (idx: number) => {
    setCurrentIdx(idx);
    setUserAnswer('');
    setTimeLeft(30);
    if (inputRef.current) inputRef.current.focus();
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 6 && prev > 1) sounds.tick();
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 1000);
  };

  const handleTimeOut = () => {
    sounds.wrong();
    showFeedback('HẾT GIỜ!', 'error');
    nextQuestion();
  };

  const checkAnswer = () => {
    const q = questions[currentIdx];
    const userClean = userAnswer.trim().toUpperCase().replace(/\s/g, '');
    const correctClean = q.answer.trim().toUpperCase().replace(/\s/g, '');

    if (userClean === correctClean) {
      if (timerRef.current) clearInterval(timerRef.current);
      sounds.correct();
      let points = (30 - timeLeft) <= 10 ? 30 : ((30 - timeLeft) <= 20 ? 20 : 10);
      setScore(s => s + points);
      showFeedback(`+${points} ĐIỂM!`, 'success');
      nextQuestion();
    } else {
      sounds.wrong();
      if (inputRef.current) {
        inputRef.current.classList.add('animate-shake');
        setTimeout(() => inputRef.current?.classList.remove('animate-shake'), 500);
      }
    }
  };

  const nextQuestion = () => {
    setTimeout(() => {
      if (currentIdx + 1 < questions.length) {
        loadQuestion(currentIdx + 1);
      } else {
        sounds.complete();
        setScreen('result');
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (screen === 'home') {
    return (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-gradient-to-br from-[#FF9A8B] via-[#FF6A88] to-[#FF99AC] p-4 rounded-3xl">
        <div className="bg-white/95 backdrop-blur-md p-10 rounded-[2rem] shadow-2xl text-center max-w-2xl w-full">
          <div className="animate-bounce mb-4 text-6xl text-yellow-400">👑</div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-pink-600 mb-2">
              VUA TIẾNG VIỆT
          </h1>
          <p className="text-gray-500 text-lg mb-8 font-medium italic">Thử thách trí tuệ - Sắp xếp ngôn từ</p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button onClick={onBack} className="px-6 py-4 rounded-full font-bold text-slate-500 hover:bg-slate-100 transition-colors">
              Quay lại
            </button>
            <button onClick={() => setScreen('rules')} className="bg-gradient-to-r from-[#FF512F] to-[#DD2476] text-white px-12 py-4 rounded-full text-xl font-black shadow-xl uppercase tracking-widest hover:scale-105 transition-transform">
                BẮT ĐẦU CHƠI
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'rules') {
    return (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-gradient-to-br from-[#FF9A8B] via-[#FF6A88] to-[#FF99AC] p-4 rounded-3xl">
        <div className="bg-white/95 backdrop-blur-md p-8 rounded-[2rem] shadow-2xl w-full max-w-2xl">
          <h2 className="text-3xl font-black text-red-600 mb-6 text-center uppercase">Luật Chơi</h2>
          
          <div className="space-y-6 text-gray-700 mb-8">
              <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex-shrink-0 flex items-center justify-center text-red-600 font-bold font-mono">1</div>
                  <p className="text-lg">Sắp xếp các chữ cái xáo trộn để tạo thành từ Tiếng Việt chính xác.</p>
              </div>
              
              <div className="bg-yellow-50 p-6 rounded-3xl border-2 border-yellow-100">
                  <h3 className="font-bold text-yellow-700 mb-4 flex items-center gap-2">
                      ⭐ CÁCH TÍNH ĐIỂM (30 giây/câu):
                  </h3>
                  <ul className="space-y-3 font-semibold">
                      <li className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                          <span>0 - 10 giây đầu:</span> <span className="text-green-600">+30 điểm</span>
                      </li>
                      <li className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                          <span>11 - 20 giây:</span> <span className="text-blue-600">+20 điểm</span>
                      </li>
                      <li className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                          <span>21 - 30 giây:</span> <span className="text-orange-600">+10 điểm</span>
                      </li>
                  </ul>
              </div>
          </div>

          <div className="text-center">
              <button onClick={startGame} className="bg-gradient-to-r from-[#FF512F] to-[#DD2476] text-white px-12 py-4 rounded-full text-xl font-black shadow-xl hover:scale-105 transition-transform">
                  VÀO CHƠI
              </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'play') {
    const q = questions[currentIdx];
    const timerPerc = (timeLeft / 30) * 100;
    
    return (
      <div className="w-full h-full min-h-[600px] flex flex-col bg-gradient-to-br from-[#FF9A8B] via-[#FF6A88] to-[#FF99AC] p-4 rounded-3xl relative overflow-hidden">
        
        {feedback && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <div className={cn(
              "px-8 py-4 rounded-full shadow-2xl border-4 bg-white animate-bounce",
              feedback.type === 'success' ? "border-green-500 text-green-600" : "border-red-500 text-red-600"
            )}>
              <span className="text-4xl font-black">{feedback.text}</span>
            </div>
          </div>
        )}

        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[2rem] shadow-2xl flex-1 flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
              <div className="font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-full text-sm">
                  Câu: <span className="text-red-600 text-lg">{currentIdx + 1}</span>/{questions.length}
              </div>
              <div className="font-bold text-white bg-red-500 px-6 py-2 rounded-full shadow-md text-sm">
                  Điểm: <span className="text-xl">{score}</span>
              </div>
          </div>

          <div className="w-full bg-gray-200 h-3 rounded-full mb-8 overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-1000",
                  timeLeft > 20 ? "bg-green-500" : timeLeft > 10 ? "bg-yellow-500" : "bg-red-500"
                )} 
                style={{ width: `${timerPerc}%` }}
              />
          </div>

          <div className="flex-1 flex flex-col md:flex-row gap-8 items-center">
              {q.image && (
                <div className="w-full md:w-1/2 h-48 md:h-full max-h-[300px] bg-gray-100 rounded-2xl flex items-center justify-center p-2 border-2 border-dashed border-red-200">
                    <img src={q.image} alt="Hint" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
              )}

              <div className={cn("flex flex-col space-y-6 w-full", q.image ? "md:w-1/2" : "max-w-2xl mx-auto")}>
                  <h3 className="text-2xl font-bold text-gray-800 text-center leading-tight">
                    {q.text}
                  </h3>
                  
                  <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border-2 border-yellow-200 text-center shadow-inner">
                      <p className="text-gray-400 text-xs uppercase font-black mb-2">Thử thách sắp xếp</p>
                      <p className="text-3xl font-black text-red-600 tracking-widest break-words drop-shadow-sm">
                        {q.scrambled}
                      </p>
                  </div>

                  <div className="space-y-4">
                      <input 
                        type="text" 
                        ref={inputRef}
                        value={userAnswer}
                        onChange={e => setUserAnswer(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                        placeholder="NHẬP TỪ HOÀN CHỈNH..."
                        className="w-full px-6 py-4 rounded-2xl border-2 border-gray-200 focus:border-red-400 outline-none text-2xl font-bold uppercase text-center placeholder:text-gray-300 transition-colors"
                      />
                      <button 
                        onClick={checkAnswer} 
                        className="w-full bg-gradient-to-r from-[#FF512F] to-[#DD2476] text-white py-4 rounded-2xl font-black text-xl uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
                      >
                          KIỂM TRA
                      </button>
                  </div>
              </div>
          </div>
        </div>
      </div>
    );
  }

  // Result Screen
  return (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-gradient-to-br from-[#FF9A8B] via-[#FF6A88] to-[#FF99AC] p-4 rounded-3xl">
      <div className="bg-white/95 backdrop-blur-md p-10 rounded-[2rem] shadow-2xl text-center max-w-lg w-full">
          <div className="mb-6 animate-bounce">
              <div className="text-7xl text-yellow-400">🏆</div>
          </div>
          <h2 className="text-4xl font-black text-gray-800 mb-2">CHÚC MỪNG</h2>
          <p className="text-gray-500 mb-8 font-medium italic">Bạn đã hoàn thành thử thách!</p>
          
          <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-3xl p-8 mb-8 inline-block min-w-[250px] shadow-xl transform hover:scale-105 transition-transform">
              <p className="text-white/80 font-bold mb-2 uppercase text-sm tracking-widest">TỔNG ĐIỂM</p>
              <p className="text-7xl font-black text-white drop-shadow-md">{score}</p>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={startGame} 
              className="w-full bg-gray-800 text-white px-8 py-4 rounded-full font-black text-lg shadow-lg hover:bg-black transition-colors"
            >
                CHƠI LẠI
            </button>
            <button 
              onClick={onBack} 
              className="w-full bg-white text-gray-800 border-2 border-gray-200 px-8 py-4 rounded-full font-black text-lg hover:bg-gray-50 transition-colors"
            >
                QUAY LẠI ỨNG DỤNG
            </button>
          </div>
      </div>
    </div>
  );
}
