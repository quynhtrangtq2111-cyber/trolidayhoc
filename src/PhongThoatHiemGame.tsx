import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export interface QuestionItem {
  id: string; content: string; options?: string[];
  correctAnswer?: string; type: string; level: string;
}
interface Props { initialQuestions: QuestionItem[]; onBack: () => void; }

// ── Types ─────────────────────────────────────────────────────────
interface Puzzle {
  question: QuestionItem;
  clueDigit: string;     // revealed on correct answer
  clueHint: string;      // label like "Số thứ nhất của mã"
}

type Screen = 'setup' | 'game' | 'lock' | 'win' | 'fail';

// ── Scenarios ─────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'lab',
    title: '🔬 Phòng Thí Nghiệm Bị Khóa',
    desc: 'Một vụ nổ đã khóa cửa phòng thí nghiệm. Giải các câu đố khoa học để tìm mã thoát!',
    bg: 'from-emerald-950 via-green-900 to-teal-900',
    accent: '#10b981',
    icon: '🔬',
    lockDesc: 'Nhập mã 4 số để mở cửa phòng thí nghiệm',
    flavor: (idx: number) => [
      '⚗️ Thiết bị phân tích hóa chất hiển thị một câu đố...',
      '🧬 Máy tính nghiên cứu đang chờ lệnh trả lời...',
      '🔭 Màn hình phóng to hiển thị câu hỏi tiếp theo...',
      '💡 Bóng đèn khẩn cấp sáng lên, lộ ra một câu đố...',
      '🧪 Ống nghiệm phát sáng khi câu đố xuất hiện...',
    ][idx % 5],
  },
  {
    id: 'space',
    title: '🚀 Tàu Vũ Trụ Mất Oxy',
    desc: 'Tàu vũ trụ đang hết oxy! Trả lời đúng từng câu hỏi để khôi phục hệ thống sống còn.',
    bg: 'from-slate-950 via-indigo-950 to-purple-950',
    accent: '#818cf8',
    icon: '🚀',
    lockDesc: 'Nhập mã khởi động hệ thống dưỡng khí',
    flavor: (idx: number) => [
      '🛸 Màn hình điều khiển chớp sáng, yêu cầu xác minh...',
      '⚡ Terminal AI tàu vũ trụ hiển thị câu hỏi bảo mật...',
      '🌌 Cửa sổ tàu hiện lên dòng chữ mật mã cần giải...',
      '🔒 Module thoát hiểm yêu cầu xác nhận kiến thức...',
      '🪐 Hệ thống điều hướng hiện thị thử thách tiếp theo...',
    ][idx % 5],
  },
  {
    id: 'vault',
    title: '🏛️ Hầm Bảo Vật Cổ Đại',
    desc: 'Bạn đã tìm thấy hầm bí mật của một nền văn minh cổ đại. Giải mã các câu đố để lấy kho báu!',
    bg: 'from-amber-950 via-yellow-900 to-orange-900',
    accent: '#f59e0b',
    icon: '🏛️',
    lockDesc: 'Nhập mã cổ đại để mở hầm bảo vật',
    flavor: (idx: number) => [
      '📜 Một cuộn giấy cổ hiện ra câu đố bí ẩn...',
      '🗿 Tượng đá cổ đại hé lộ câu hỏi trên nền đá...',
      '💎 Viên pha lê phát sáng, chiếu ra câu đố...',
      '🏺 Chiếc bình cổ vỡ ra để lộ chữ viết bí ẩn...',
      '🕯️ Ngọn nến bùng sáng, hé lộ câu hỏi tiếp theo...',
    ][idx % 5],
  },
  {
    id: 'island',
    title: '🏝️ Đảo Bí Ẩn',
    desc: 'Mắc kẹt trên hòn đảo bí ẩn! Giải các câu đố trong thiên nhiên để tìm đường trở về đất liền.',
    bg: 'from-sky-950 via-blue-900 to-cyan-900',
    accent: '#06b6d4',
    icon: '🏝️',
    lockDesc: 'Nhập mã tín hiệu SOS để gọi tàu cứu hộ',
    flavor: (idx: number) => [
      '🐚 Vỏ ốc biển phát ra âm thanh, hiện ra câu đố...',
      '🌊 Sóng biển cuốn đến chai thủy tinh có câu hỏi...',
      '🦜 Vẹt bí ẩn nói ra câu đố tiếp theo...',
      '🗺️ Bản đồ kho báu hé lộ câu hỏi ẩn giấu...',
      '⛵ Đèn hiệu nhấp nháy theo mã Morse chứa câu đố...',
    ][idx % 5],
  },
];

// ── Generate clue digits from question pool ───────────────────────
function buildPuzzles(qs: QuestionItem[], count: number): Puzzle[] {
  const DIGITS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const shuffled = [...qs].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((q, i) => ({
    question: q,
    clueDigit: DIGITS[Math.floor(Math.random() * 10)], // revealed on correct
    clueHint: `Ký tự thứ ${i + 1}`,
  }));
}

// ── Resolve correct answer letter/text ───────────────────────────
function getCorrectText(q: QuestionItem): string {
  if (!q.correctAnswer) return '';
  const ca = q.correctAnswer.trim().toUpperCase();
  const letters = ['A','B','C','D'];
  const idx = letters.indexOf(ca);
  if (idx !== -1 && q.options && q.options[idx]) return q.options[idx];
  return q.correctAnswer;
}

// ── Drag-Drop helpers ─────────────────────────────────────────────
function isDragDrop(q: QuestionItem) {
  return q.type === 'Kéo thả' || q.type === 'Điền khuyết';
}

// ════════════════════════════════════════════════════════════════
export default function PhongThoatHiemGame({ initialQuestions, onBack }: Props) {
  // ── Setup state ────────────────────────────────────────────────
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [playerName, setPlayerName] = useState('');
  const [puzzleCount, setPuzzleCount] = useState(4);

  // ── Game state ─────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>('setup');
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [collected, setCollected] = useState<string[]>([]);   // revealed code digits
  const [answered, setAnswered] = useState(false);
  const [ansState, setAnsState] = useState<('idle'|'correct'|'wrong')[]>([]);
  const [feedback, setFeedback] = useState<{ok: boolean; msg: string} | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [revealClue, setRevealClue] = useState(false);

  // drag-drop
  const [ddLeft, setDdLeft] = useState<string[]>([]);
  const [ddRight, setDdRight] = useState<string[]>([]);
  const [ddPairs, setDdPairs] = useState<{left: string; right: string}[]>([]);
  const [ddSelected, setDdSelected] = useState<string | null>(null);
  const [ddSide, setDdSide] = useState<'left'|'right'|null>(null);

  // lock screen
  const [lockInput, setLockInput] = useState<string[]>([]);
  const [lockAttempts, setLockAttempts] = useState(0);
  const lockRefs = useRef<(HTMLInputElement|null)[]>([]);

  // timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // ── Timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'game') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;

  // ── Start game ─────────────────────────────────────────────────
  const startGame = () => {
    const valid = initialQuestions.filter(q =>
      (q.options && q.options.length >= 2) || isDragDrop(q)
    );
    const count = Math.min(puzzleCount, valid.length, 8);
    if (count < 1) return;
    const ps = buildPuzzles(valid, count);
    setPuzzles(ps);
    setCurrentIdx(0);
    setCollected([]);
    setAnswered(false);
    setFeedback(null);
    setAttempts(0);
    setRevealClue(false);
    setElapsed(0);
    setLockInput([]);
    setLockAttempts(0);
    loadQuestion(ps[0]);
    setScreen('game');
  };

  const loadQuestion = (p: Puzzle) => {
    setAnswered(false);
    setFeedback(null);
    setAttempts(0);
    setRevealClue(false);
    setAnsState(new Array(p.question.options?.length || 4).fill('idle'));
    if (isDragDrop(p.question)) initDragDrop(p.question);
  };

  const initDragDrop = (q: QuestionItem) => {
    // For drag-drop: left = question parts, right = answer options shuffled
    const opts = q.options || [];
    setDdLeft(opts.map((_, i) => ['A','B','C','D'][i]));
    setDdRight([...opts].sort(() => Math.random() - 0.5));
    setDdPairs([]);
    setDdSelected(null);
    setDdSide(null);
  };

  // ── Multiple choice answer ─────────────────────────────────────
  const handleMCAnswer = (idx: number) => {
    if (answered) return;
    const p = puzzles[currentIdx];
    const q = p.question;
    const opts = q.options || [];
    const ca = (q.correctAnswer || '').trim().toUpperCase();
    const letters = ['A','B','C','D'];
    const corrIdx = letters.indexOf(ca) !== -1 ? letters.indexOf(ca)
      : opts.findIndex(o => o.trim().toLowerCase() === (q.correctAnswer||'').trim().toLowerCase());
    const isCorrect = idx === corrIdx || idx === corrIdx;

    const newState = opts.map((_, i) =>
      i === corrIdx ? 'correct' : i === idx && !isCorrect ? 'wrong' : 'idle'
    ) as typeof ansState;
    setAnsState(newState);

    if (isCorrect) {
      setAnswered(true);
      setRevealClue(true);
      setCollected(prev => [...prev, p.clueDigit]);
      setFeedback({ ok: true, msg: `🔑 Chính xác! ${p.clueHint}: "${p.clueDigit}" đã được tiết lộ!` });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setAnswered(true);
        setRevealClue(true);
        setCollected(prev => [...prev, '?']); // wrong → '?' placeholder
        setFeedback({ ok: false, msg: `❌ Hết lượt thử! Ký tự bị mất. Đáp án: ${getCorrectText(q)}` });
      } else {
        setFeedback({ ok: false, msg: `❌ Sai rồi! Bạn còn ${3 - newAttempts} lượt thử.` });
        setTimeout(() => setFeedback(null), 2000);
      }
    }
  };

  // ── Drag-drop matching ─────────────────────────────────────────
  const handleDdClick = (item: string, side: 'left'|'right') => {
    if (answered) return;
    // Already paired?
    if (ddPairs.some(p => p.left === item || p.right === item)) return;

    if (!ddSelected) {
      setDdSelected(item); setDdSide(side);
    } else {
      if (ddSide === side) {
        setDdSelected(item); setDdSide(side); return;
      }
      // Pair them
      const left = side === 'left' ? item : ddSelected;
      const right = side === 'right' ? item : ddSelected;
      setDdPairs(prev => [...prev, { left, right }]);
      setDdSelected(null); setDdSide(null);

      // Check if all paired
      const opts = puzzles[currentIdx]?.question.options || [];
      if (ddPairs.length + 1 >= Math.min(ddLeft.length, ddRight.length)) {
        handleDdSubmit([...ddPairs, { left, right }], opts);
      }
    }
  };

  const handleDdSubmit = (pairs: {left:string,right:string}[], opts: string[]) => {
    const p = puzzles[currentIdx];
    // Check: correct order = A→opts[0], B→opts[1] etc.
    const letters = ['A','B','C','D'];
    let correct = 0;
    pairs.forEach(pair => {
      const li = letters.indexOf(pair.left);
      if (li !== -1 && opts[li] === pair.right) correct++;
    });
    const isCorrect = correct === pairs.length && pairs.length > 0;
    setAnswered(true);
    setRevealClue(true);
    if (isCorrect) {
      setCollected(prev => [...prev, p.clueDigit]);
      setFeedback({ ok: true, msg: `🔑 Ghép đúng hoàn toàn! "${p.clueDigit}" đã được tiết lộ!` });
    } else {
      setCollected(prev => [...prev, '?']);
      setFeedback({ ok: false, msg: `❌ Một số cặp sai! Ký tự bị mất.` });
    }
  };

  const handleDdReset = () => { setDdPairs([]); setDdSelected(null); setDdSide(null); };

  // ── Proceed to next puzzle ─────────────────────────────────────
  const nextPuzzle = () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= puzzles.length) {
      setLockInput(new Array(puzzles.length).fill(''));
      setScreen('lock');
    } else {
      setCurrentIdx(nextIdx);
      loadQuestion(puzzles[nextIdx]);
    }
  };

  // ── Lock screen ────────────────────────────────────────────────
  const handleLockInput = (val: string, i: number) => {
    const next = [...lockInput];
    next[i] = val.toUpperCase().slice(-1);
    setLockInput(next);
    if (val && i < puzzles.length - 1) lockRefs.current[i+1]?.focus();
  };

  const checkLock = () => {
    const code = puzzles.map(p => p.clueDigit).join('');
    const entered = lockInput.join('');
    if (entered === code) {
      setScreen('win');
    } else {
      const newAttempts = lockAttempts + 1;
      setLockAttempts(newAttempts);
      if (newAttempts >= 3) setScreen('fail');
    }
  };

  // ── Helpers ────────────────────────────────────────────────────
  const totalValid = initialQuestions.filter(q =>
    (q.options && q.options.length >= 2) || isDragDrop(q)
  ).length;
  const progress = puzzles.length > 0 ? currentIdx / puzzles.length : 0;
  const currentScenario = scenario;
  const sc = currentScenario; // shorthand

  // ════════════════════════════════════════════════════════════════
  // SETUP SCREEN
  // ════════════════════════════════════════════════════════════════
  if (screen === 'setup') {
    return (
      <div className="min-h-[640px] rounded-3xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(160deg,#0f0f1e,#1a1a3e,#0d0d20)' }}>

        {/* Header */}
        <div className="relative text-center py-8 px-4"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#a855f7)' }}>
          <button onClick={onBack}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
            ← Đổi Game
          </button>
          <div className="text-5xl mb-2">🚪</div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight">Phòng Thoát Hiểm</h1>
          <p className="text-white/70 text-sm mt-1">Giải câu đố — Thu thập mã — Thoát khỏi phòng!</p>
        </div>

        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scenario selection */}
          <div className="space-y-4">
            <h3 className="text-white/80 text-xs font-black uppercase tracking-widest">🎭 Chọn Kịch Bản</h3>
            <div className="space-y-2">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => setScenario(s)}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                    scenario.id === s.id
                      ? 'border-violet-500 bg-violet-900/40'
                      : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{s.icon}</span>
                    <div>
                      <div className="font-black text-white text-sm">{s.title.replace(/^[^\s]+\s/, '')}</div>
                      <div className="text-white/50 text-xs mt-0.5 leading-snug">{s.desc.slice(0, 60)}…</div>
                    </div>
                    {scenario.id === s.id && <span className="ml-auto text-violet-400">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Config right */}
          <div className="space-y-5">
            {/* Player name */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <label className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-2">🧑‍🎓 Tên người chơi</label>
              <input value={playerName} onChange={e => setPlayerName(e.target.value)}
                placeholder="Nhập tên của bạn…"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 outline-none focus:border-violet-400 transition-all font-semibold" />
            </div>

            {/* Puzzle count */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <label className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-3">🔢 Số câu đố ({puzzleCount} câu)</label>
              <div className="flex gap-2 flex-wrap">
                {[3,4,5,6,8].map(n => (
                  <button key={n} onClick={() => setPuzzleCount(n)}
                    disabled={n > totalValid}
                    className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${
                      puzzleCount === n
                        ? 'bg-violet-600 text-white'
                        : n > totalValid
                        ? 'bg-white/5 text-white/20 cursor-not-allowed'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-2">{totalValid} câu hỏi hợp lệ trong bộ đề</p>
            </div>

            {/* Scenario preview */}
            <div className={`rounded-2xl p-4 bg-gradient-to-br ${sc.bg} border border-white/10`}>
              <div className="text-2xl mb-1">{sc.icon}</div>
              <p className="text-white/80 text-sm leading-relaxed">{sc.desc}</p>
            </div>

            {/* Start */}
            <button onClick={startGame} disabled={totalValid < 1}
              className="w-full py-4 rounded-2xl text-white font-black text-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)', boxShadow: '0 8px 32px rgba(168,85,247,0.4)' }}>
              🚪 VÀO PHÒNG THOÁT HIỂM!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // WIN SCREEN
  // ════════════════════════════════════════════════════════════════
  if (screen === 'win') {
    const code = puzzles.map(p => p.clueDigit).join('');
    const collected_ok = collected.filter(c => c !== '?').length;
    return (
      <div className={`min-h-[600px] rounded-3xl flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br ${sc.bg}`}>
        <div className="text-8xl mb-4 animate-bounce">🎉</div>
        <h2 className="text-4xl font-black text-white uppercase tracking-tight mb-2">THOÁT THÀNH CÔNG!</h2>
        <div className="text-white/70 text-lg mb-6">
          {playerName ? `Chúc mừng ${playerName}!` : 'Chúc mừng!'} Bạn đã mở được cửa phòng!
        </div>
        <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20 space-y-3 w-full max-w-xs">
          <div className="flex justify-between text-sm text-white/70"><span>Thời gian</span><span className="font-bold text-white">{fmtTime(elapsed)}</span></div>
          <div className="flex justify-between text-sm text-white/70"><span>Câu đúng</span><span className="font-bold text-white">{collected_ok} / {puzzles.length}</span></div>
          <div className="flex justify-between text-sm text-white/70"><span>Mã khóa</span><span className="font-black text-yellow-400 tracking-widest">{code}</span></div>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={startGame} className="px-8 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-black transition-all">🔄 Chơi lại</button>
          <button onClick={() => setScreen('setup')} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all">⚙️ Đổi kịch bản</button>
          <button onClick={onBack} className="px-8 py-3 bg-white/5 hover:bg-white/15 text-white rounded-2xl font-bold transition-all">← Đổi Game</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // FAIL SCREEN
  // ════════════════════════════════════════════════════════════════
  if (screen === 'fail') {
    const code = puzzles.map(p => p.clueDigit).join('');
    return (
      <div className="min-h-[600px] rounded-3xl flex flex-col items-center justify-center p-8 text-center"
        style={{ background: 'linear-gradient(160deg,#1a0a0a,#3b0a0a,#7f1d1d)' }}>
        <div className="text-8xl mb-4">💀</div>
        <h2 className="text-4xl font-black text-red-400 uppercase tracking-tight mb-2">MỌI HY VỌNG ĐÃ TIÊU TAN</h2>
        <p className="text-white/60 text-lg mb-6">Bạn đã dùng hết lượt thử mã khóa.</p>
        <div className="bg-black/40 rounded-2xl p-5 mb-6 border border-red-900/50 w-full max-w-xs">
          <p className="text-white/50 text-xs mb-2">Mã đúng lẽ ra là:</p>
          <div className="text-yellow-400 font-black text-3xl tracking-[0.5em]">{code}</div>
        </div>
        <div className="flex gap-3">
          <button onClick={startGame} className="px-8 py-3 bg-red-700 hover:bg-red-600 text-white rounded-2xl font-black transition-all">🔄 Thử lại</button>
          <button onClick={onBack} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all">← Đổi Game</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // LOCK SCREEN
  // ════════════════════════════════════════════════════════════════
  if (screen === 'lock') {
    return (
      <div className={`min-h-[640px] rounded-3xl overflow-hidden flex flex-col bg-gradient-to-br ${sc.bg}`}>
        {/* Header */}
        <div className="text-center pt-8 pb-4 px-6">
          <div className="text-5xl mb-3">🔐</div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Ổ Khóa Cuối Cùng!</h2>
          <p className="text-white/60 text-sm mt-2">{sc.lockDesc}</p>
        </div>

        {/* Collected clues */}
        <div className="mx-6 mb-6 bg-black/30 rounded-2xl p-5 border border-white/10">
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest text-center mb-4">Các ký tự đã thu thập</p>
          <div className="flex gap-3 justify-center flex-wrap">
            {puzzles.map((p, i) => (
              <div key={i} className="text-center">
                <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center font-black text-2xl ${
                  collected[i] === '?' ? 'border-red-500/50 bg-red-900/30 text-red-400' : 'border-white/20 bg-white/10 text-yellow-400'
                }`}>
                  {collected[i] || '?'}
                </div>
                <div className="text-white/30 text-xs mt-1">{p.clueHint.replace('Ký tự thứ ','#')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lock input */}
        <div className="mx-6 mb-6">
          <p className="text-white/60 text-sm text-center mb-4">Nhập mã theo thứ tự ký tự đã thu thập:</p>
          <div className="flex gap-3 justify-center flex-wrap">
            {puzzles.map((_, i) => (
              <input key={i}
                ref={el => { lockRefs.current[i] = el; }}
                value={lockInput[i] || ''}
                onChange={e => handleLockInput(e.target.value, i)}
                maxLength={1}
                className="w-14 h-14 rounded-xl bg-white/10 border-2 border-white/20 text-white text-center text-2xl font-black outline-none focus:border-yellow-400 uppercase transition-all"
              />
            ))}
          </div>
          {lockAttempts > 0 && (
            <p className="text-red-400 text-sm text-center mt-3 font-bold">
              ❌ Mã sai! Còn {3 - lockAttempts} lượt thử.
            </p>
          )}
        </div>

        {/* Hint: collected correct ones */}
        <div className="mx-6 mb-4 p-3 bg-white/5 rounded-xl text-center">
          <p className="text-white/40 text-xs">💡 Gợi ý: Những ô màu vàng là ký tự thu thập được khi trả lời đúng.</p>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={checkLock}
            disabled={lockInput.filter(Boolean).length < puzzles.length}
            className="flex-1 py-4 rounded-2xl text-white font-black text-xl transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', boxShadow: '0 8px 24px rgba(239,68,68,0.4)' }}>
            🔓 MỞ KHÓA!
          </button>
          <button onClick={onBack} className="px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all">
            ← Thoát
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // GAME SCREEN
  // ════════════════════════════════════════════════════════════════
  const currentPuzzle = puzzles[currentIdx];
  const q = currentPuzzle?.question;
  const opts = q?.options || [];
  const letters = ['A','B','C','D'];

  return (
    <div className={`min-h-[640px] rounded-3xl overflow-hidden flex flex-col bg-gradient-to-br ${sc.bg}`}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 bg-black/30 border-b border-white/10">
        <button onClick={onBack} className="text-white/50 hover:text-white text-sm font-bold transition-colors">← Thoát</button>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">⏱</span>
          <span className="text-white font-bold text-sm tracking-widest">{fmtTime(elapsed)}</span>
        </div>
        <div className="text-white/50 text-xs font-bold">
          {sc.icon} Câu {currentIdx + 1}/{puzzles.length}
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div className="h-full transition-all duration-700 rounded-full"
          style={{ width: `${(currentIdx / puzzles.length) * 100}%`,
            background: `linear-gradient(90deg,${sc.accent},#a855f7)` }} />
      </div>

      {/* Collected code so far */}
      <div className="flex items-center gap-2 px-5 py-3 bg-black/20">
        <span className="text-white/40 text-xs font-bold">🔑 Mã đã thu:</span>
        <div className="flex gap-1.5">
          {puzzles.map((p, i) => (
            <div key={i} className={`w-8 h-8 rounded-lg border flex items-center justify-center font-black text-sm ${
              i < collected.length
                ? collected[i] === '?'
                  ? 'border-red-500/60 bg-red-900/30 text-red-400'
                  : 'border-yellow-500/60 bg-yellow-900/30 text-yellow-400'
                : i === currentIdx
                ? 'border-white/30 bg-white/10 text-white/40 animate-pulse'
                : 'border-white/10 bg-black/20 text-white/20'
            }`}>
              {i < collected.length ? collected[i] : i === currentIdx ? '?' : '·'}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Flavor text */}
        <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
          <p className="text-white/50 text-sm italic">{sc.flavor(currentIdx)}</p>
        </div>

        {/* Question */}
        <div className="bg-black/30 border border-white/10 rounded-2xl p-5">
          <div className="text-white/80 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
            <span style={{ color: sc.accent }}>◆</span> Câu đố #{currentIdx + 1}
            {attempts > 0 && !answered && (
              <span className="ml-auto text-orange-400 text-xs">⚠ Còn {3 - attempts} lượt</span>
            )}
          </div>
          <div className="text-white font-semibold leading-relaxed prose prose-invert prose-sm max-w-none">
            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q?.content || ''}</Markdown>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`px-5 py-3 rounded-2xl text-sm font-bold border ${
            feedback.ok
              ? 'bg-green-900/40 border-green-500/40 text-green-300'
              : 'bg-red-900/40 border-red-500/40 text-red-300'
          }`}>
            {feedback.msg}
          </div>
        )}

        {/* Revealed clue */}
        {revealClue && (
          <div className="bg-yellow-900/30 border border-yellow-500/40 rounded-2xl p-4 text-center animate-pulse">
            <p className="text-yellow-300/70 text-xs font-bold mb-1">{currentPuzzle?.clueHint}</p>
            <div className="text-4xl font-black text-yellow-400 tracking-[0.5em]">
              {collected[currentIdx] || '?'}
            </div>
          </div>
        )}

        {/* Multiple choice answers */}
        {!isDragDrop(q || {} as QuestionItem) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {opts.map((opt, i) => {
              const state = ansState[i] || 'idle';
              return (
                <button key={i} onClick={() => handleMCAnswer(i)}
                  disabled={answered && state === 'idle'}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200 font-semibold ${
                    state === 'correct'
                      ? 'bg-green-500/30 border-green-400 text-white shadow-lg'
                      : state === 'wrong'
                      ? 'bg-red-500/20 border-red-400 text-red-200'
                      : answered
                      ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                      : 'bg-white/8 border-white/15 text-white hover:bg-white/15 hover:border-white/30 cursor-pointer'
                  }`}>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 border ${
                    state === 'correct' ? 'bg-green-400 border-green-300 text-white' :
                    state === 'wrong'   ? 'bg-red-500 border-red-400 text-white' :
                                          'bg-white/10 border-white/20 text-white/60'
                  }`}>
                    {state === 'correct' ? '✓' : state === 'wrong' ? '✗' : letters[i]}
                  </span>
                  <span className="text-sm leading-snug flex-1">
                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</Markdown>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Drag-drop matching */}
        {isDragDrop(q || {} as QuestionItem) && !answered && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-white/50 text-xs font-bold">
              <span>Nhấn chọn ở cột trái rồi chọn cột phải để ghép</span>
              <button onClick={handleDdReset} className="text-orange-400 hover:text-orange-300">↩ Reset</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-2">
                <p className="text-white/40 text-xs font-bold text-center">Phương án</p>
                {ddLeft.map(item => {
                  const isPaired = ddPairs.some(p => p.left === item);
                  const isSelected = ddSelected === item && ddSide === 'left';
                  return (
                    <button key={item} onClick={() => handleDdClick(item, 'left')}
                      disabled={isPaired}
                      className={`w-full p-3 rounded-xl text-sm font-bold border-2 text-left transition-all ${
                        isPaired ? 'bg-green-900/30 border-green-500/40 text-green-400' :
                        isSelected ? 'bg-violet-600/40 border-violet-400 text-white' :
                        'bg-white/8 border-white/15 text-white hover:border-white/30'
                      }`}>
                      {isPaired ? `✓ ${item}` : isSelected ? `▶ ${item}` : item}
                    </button>
                  );
                })}
              </div>
              {/* Right column */}
              <div className="space-y-2">
                <p className="text-white/40 text-xs font-bold text-center">Nội dung</p>
                {ddRight.map(item => {
                  const isPaired = ddPairs.some(p => p.right === item);
                  const isSelected = ddSelected === item && ddSide === 'right';
                  return (
                    <button key={item} onClick={() => handleDdClick(item, 'right')}
                      disabled={isPaired}
                      className={`w-full p-3 rounded-xl text-xs font-semibold border-2 text-left transition-all ${
                        isPaired ? 'bg-green-900/30 border-green-500/40 text-green-300' :
                        isSelected ? 'bg-violet-600/40 border-violet-400 text-white' :
                        'bg-white/8 border-white/15 text-white/80 hover:border-white/30'
                      }`}>
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Next button */}
        {answered && (
          <button onClick={nextPuzzle}
            className="w-full py-4 rounded-2xl text-white font-black text-lg transition-all hover:scale-105"
            style={{ background: `linear-gradient(135deg,${sc.accent},#a855f7)`,
              boxShadow: `0 8px 24px ${sc.accent}55` }}>
            {currentIdx + 1 < puzzles.length ? '➡ Câu tiếp theo' : '🔐 Đến ổ khóa cuối!'}
          </button>
        )}
      </div>
    </div>
  );
}
