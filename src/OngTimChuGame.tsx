import React, { useState, useEffect, useRef, useCallback } from 'react';
import MathText from './MathText';


interface QuestionItem {
  id: string; content: string; options?: string[];
  correctAnswer?: string; type: string; level: string;
}
interface Props { initialQuestions: QuestionItem[]; onBack: () => void; }

// ── Constants ──────────────────────────────────────────────────────
const DIRECTIONS = [[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]];
const FILL_CHARS = 'ABCDEFGHIKLMNOPQRSTUVXY';
const WORD_COLORS = ['#E74C3C','#3498DB','#2ECC71','#9B59B6','#E67E22','#1ABC9C','#F39C12','#E84393'];

// Strip Vietnamese diacritics for the grid
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z]/g, '');
}

interface WordPos { word: string; cells: { r: number; c: number }[]; original: string; }

function placeWord(grid: string[][], word: string, size: number): WordPos | null {
  for (let attempt = 0; attempt < 200; attempt++) {
    const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const startR = Math.floor(Math.random() * size);
    const startC = Math.floor(Math.random() * size);
    let fits = true;
    const cells: { r: number; c: number }[] = [];
    for (let i = 0; i < word.length; i++) {
      const r = startR + dir[0] * i;
      const c = startC + dir[1] * i;
      if (r < 0 || r >= size || c < 0 || c >= size) { fits = false; break; }
      if (grid[r][c] !== '' && grid[r][c] !== word[i]) { fits = false; break; }
      cells.push({ r, c });
    }
    if (fits) {
      cells.forEach((pos, i) => { grid[pos.r][pos.c] = word[i]; });
      return { word, cells, original: word };
    }
  }
  return null;
}

function buildGrid(words: string[]): { grid: string[][]; positions: WordPos[] } {
  const maxLen = Math.max(...words.map(w => w.length), 6);
  const size = Math.min(15, Math.max(12, Math.ceil(maxLen * 1.5)));
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const positions: WordPos[] = [];
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  for (const w of shuffled) {
    const wp = placeWord(grid, w, size);
    if (wp) positions.push(wp);
  }
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] === '')
        grid[r][c] = FILL_CHARS[Math.floor(Math.random() * FILL_CHARS.length)];
  return { grid, positions };
}

// ── Component ─────────────────────────────────────────────────────
export default function OngTimChuGame({ initialQuestions, onBack }: Props) {
  const [screen, setScreen] = useState<'start' | 'game' | 'win'>('start');
  const [playerName, setPlayerName] = useState('');

  // Game state
  const [grid, setGrid] = useState<string[][]>([]);
  const [positions, setPositions] = useState<WordPos[]>([]);
  const [answers, setAnswers] = useState<string[]>([]); // normalised
  const [qIdx, setQIdx] = useState(0);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [foundColors, setFoundColors] = useState<Map<string, string>>(new Map());
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(0);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Selection
  const [selecting, setSelecting] = useState(false);
  const [selStart, setSelStart] = useState<{ r: number; c: number } | null>(null);
  const [selCells, setSelCells] = useState<{ r: number; c: number }[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const foundRef = useRef(foundWords);
  foundRef.current = foundWords;

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2000);
  };

  // Prepare answers (normalized)
  const normAnswers = initialQuestions.map(q => normalize(q.correctAnswer || q.content));

  // ── Start game ─────────────────────────────────────────────────
  const startGame = () => {
    const words = normAnswers.filter(w => w.length > 0);
    const { grid: g, positions: p } = buildGrid(words);
    setGrid(g);
    setPositions(p);
    setAnswers(words);
    setQIdx(0);
    setFoundWords(new Set());
    setFoundColors(new Map());
    setScore(0);
    setTimer(0);
    setSelCells([]);
    setSelStart(null);
    setSelecting(false);
    setScreen('game');
  };

  useEffect(() => {
    if (screen === 'game') {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  // ── Selection logic ────────────────────────────────────────────
  const extendSel = (r: number, c: number, start: { r: number; c: number }) => {
    const dr = r - start.r, dc = c - start.c;
    const absDr = Math.abs(dr), absDc = Math.abs(dc);
    if (dr !== 0 && dc !== 0 && absDr !== absDc) return;
    const len = Math.max(absDr, absDc);
    const stepR = dr === 0 ? 0 : dr / absDr;
    const stepC = dc === 0 ? 0 : dc / absDc;
    const cells: { r: number; c: number }[] = [];
    for (let i = 0; i <= len; i++)
      cells.push({ r: start.r + stepR * i, c: start.c + stepC * i });
    setSelCells(cells);
  };

  const checkSel = useCallback((cells: { r: number; c: number }[], currentGrid: string[][], currentPositions: WordPos[], currentQIdx: number, currentAnswers: string[]) => {
    if (cells.length === 0) return;
    const selectedWord = cells.map(p => currentGrid[p.r]?.[p.c] ?? '').join('');
    const currentAnswer = currentAnswers[currentQIdx];
    for (const wp of currentPositions) {
      if (wp.word !== currentAnswer) continue;
      if (foundRef.current.has(wp.word)) continue;
      const wpWord = wp.cells.map(p => currentGrid[p.r][p.c]).join('');
      if (selectedWord === wpWord || selectedWord === wpWord.split('').reverse().join('')) {
        // Found!
        const color = WORD_COLORS[currentQIdx % WORD_COLORS.length];
        setFoundWords(prev => new Set([...prev, wp.word]));
        setFoundColors(prev => new Map([...prev, [wp.word, color]]));
        setScore(s => s + wp.word.length * 10);
        showToast(`🐝 Đúng rồi! +${wp.word.length * 10} điểm`, true);
        if (currentQIdx < currentAnswers.length - 1) {
          setTimeout(() => setQIdx(i => i + 1), 600);
        } else {
          setTimeout(() => setScreen('win'), 800);
        }
        return;
      }
    }
    showToast('Chưa đúng, thử lại!', false);
  }, []);

  // ── Cell events ────────────────────────────────────────────────
  const onCellDown = (r: number, c: number) => {
    setSelecting(true);
    setSelStart({ r, c });
    setSelCells([{ r, c }]);
  };
  const onCellEnter = (r: number, c: number) => {
    if (!selecting || !selStart) return;
    extendSel(r, c, selStart);
  };
  const onMouseUp = () => {
    if (!selecting) return;
    setSelecting(false);
    checkSel(selCells, grid, positions, qIdx, answers);
    setSelCells([]);
  };

  // Touch support
  const gridRef = useRef<HTMLDivElement>(null);
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
    if (el?.dataset.row && el?.dataset.col && selStart) {
      extendSel(parseInt(el.dataset.row), parseInt(el.dataset.col), selStart);
    }
  };

  // ── Cell styling ───────────────────────────────────────────────
  const currentAnswer = answers[qIdx];
  const cellStyle = (r: number, c: number): React.CSSProperties => {
    const isSel = selCells.some(p => p.r === r && p.c === c);
    // Find if this cell belongs to a found word
    for (const wp of positions) {
      if (!foundWords.has(wp.word)) continue;
      if (wp.cells.some(p => p.r === r && p.c === c)) {
        const color = foundColors.get(wp.word) || '#2ECC71';
        return { background: color, color: 'white', border: `2px solid ${color}`, fontWeight: 800 };
      }
    }
    if (isSel) return { background: '#FFD54F', color: '#3E2723', border: '2px solid #FF8F00' };
    return { background: '#FFF9E8', color: '#5D4037', border: '2px solid #FFE082' };
  };

  // ── Hint ───────────────────────────────────────────────────────
  const [hintCell, setHintCell] = useState<{ r: number; c: number } | null>(null);
  const giveHint = () => {
    const wp = positions.find(p => p.word === currentAnswer && !foundWords.has(p.word));
    if (!wp) return;
    setHintCell(wp.cells[0]);
    setScore(s => Math.max(0, s - 5));
    showToast(`💡 Từ "${currentAnswer}" bắt đầu bằng "${currentAnswer[0]}"`, false);
    setTimeout(() => setHintCell(null), 2000);
  };

  const isHint = (r: number, c: number) => hintCell?.r === r && hintCell?.c === c;

  // ── WIN SCREEN ─────────────────────────────────────────────────
  if (screen === 'win') return (
    <div className="min-h-[560px] rounded-3xl flex flex-col items-center justify-center p-8 text-center"
      style={{ background: 'linear-gradient(135deg, #FFF8E7, #FFF0C0)' }}>
      <div className="text-6xl mb-4">🎉🐝🏆</div>
      <h2 className="text-3xl font-black mb-2" style={{ color: '#FF8C00', fontFamily: 'Baloo 2, cursive' }}>TUYỆT VỜI!</h2>
      <p className="font-semibold mb-4" style={{ color: '#5D4037' }}>Bạn đã tìm hết tất cả từ!</p>
      <div className="flex gap-6 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow text-center">
          <div className="text-3xl font-black" style={{ color: '#FF8C00' }}>{score}</div>
          <div className="text-xs text-slate-500">Điểm số</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow text-center">
          <div className="text-3xl font-black" style={{ color: '#2ECC71' }}>{fmt(timer)}</div>
          <div className="text-xs text-slate-500">Thời gian</div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={startGame}
          className="px-6 py-3 rounded-xl font-bold text-white shadow transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #FF8C00, #FFB800)' }}>🐝 Chơi lại</button>
        <button onClick={onBack}
          className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-white shadow hover:bg-slate-50">Đổi Game</button>
      </div>
    </div>
  );

  // ── START SCREEN ───────────────────────────────────────────────
  if (screen === 'start') return (
    <div className="min-h-[560px] rounded-3xl flex flex-col items-center justify-center p-8 text-center"
      style={{ background: 'linear-gradient(135deg, #FFF8E7, #FFE0A0)' }}>
      <button onClick={onBack}
        className="self-start px-4 py-2 rounded-xl text-sm mb-6 font-bold" style={{ background: '#FFD060', color: '#7B3F00' }}>← Đổi Game</button>
      <div className="text-6xl mb-2" style={{ animation: 'float 3s ease-in-out infinite' }}>🐝</div>
      <h1 className="text-4xl font-black mb-1 uppercase" style={{ fontFamily: 'Baloo 2, cursive', color: '#FF8C00', textShadow: '2px 2px 0 rgba(0,0,0,0.15)' }}>🍯 Ong Tìm Chữ 🍯</h1>
      <p className="text-sm mb-6" style={{ color: '#7B3F00' }}>Tìm đáp án ẩn trong bảng chữ cái</p>
      <input type="text" placeholder="Nhập tên học sinh..." value={playerName} onChange={e => setPlayerName(e.target.value)}
        className="w-full max-w-xs px-4 py-3 rounded-xl border-2 text-center font-semibold mb-4 outline-none"
        style={{ borderColor: '#FFD060', background: 'white' }} />
      <button onClick={() => { if (playerName.trim()) startGame(); }}
        disabled={!playerName.trim()}
        className="px-8 py-4 rounded-xl font-black text-white text-lg shadow-lg transition-all hover:scale-105 disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #FF8C00, #FFB800)' }}>
        Bắt đầu tìm chữ! 🔍
      </button>
      <div className="mt-4 bg-white/60 rounded-2xl p-4 text-left text-sm max-w-xs" style={{ color: '#7B3F00' }}>
        <p className="font-bold mb-2">🐝 Cách chơi:</p>
        <ul className="space-y-1 text-xs">
          <li>• Câu hỏi hiện ở trái, tìm đáp án trong bảng chữ</li>
          <li>• Nhấn ô đầu rồi kéo đến ô cuối của từ</li>
          <li>• Từ nằm ngang, dọc hoặc chéo</li>
          <li>• Dùng 💡 Gợi ý nếu cần (-5 điểm)</li>
        </ul>
      </div>
      <p className="mt-3 text-xs" style={{ color: '#A07040' }}>{initialQuestions.length} câu hỏi</p>
    </div>
  );

  // ── GAME SCREEN ────────────────────────────────────────────────
  const gridSize = grid.length;
  const currentQ = initialQuestions[qIdx];

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: '#FFF8E7' }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl font-bold text-white shadow-xl text-sm"
          style={{ background: toast.ok ? '#2ECC71' : '#E67E22', animation: 'slideUp 0.3s ease-out' }}>
          {toast.msg}
        </div>
      )}

      {/* Header bar */}
      <div className="w-full py-3 px-4 flex flex-wrap items-center justify-center gap-4"
        style={{ background: 'linear-gradient(135deg, #FF9500, #FFB800)' }}>
        <span className="bg-white/25 backdrop-blur rounded-full px-4 py-1.5 text-white font-extrabold text-sm">
          ⭐ {score} điểm
        </span>
        <span className="bg-white/25 backdrop-blur rounded-full px-4 py-1.5 text-white font-extrabold text-sm">
          ⏱️ {fmt(timer)}
        </span>
        <span className="bg-white/25 backdrop-blur rounded-full px-4 py-1.5 text-white font-extrabold text-sm">
          🏆 {foundWords.size}/{answers.length}
        </span>
        <span className="bg-white/25 backdrop-blur rounded-full px-4 py-1.5 text-white font-bold text-sm">
          👤 {playerName}
        </span>
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-4 p-4">
        {/* Left: Question + controls */}
        <div className="lg:w-1/3 w-full flex flex-col gap-3">
          {/* Question */}
          <div className="rounded-2xl p-4 shadow border-2" style={{ background: 'white', borderColor: '#FFD060' }}>
            <div className="flex items-center gap-2 mb-2">
              <span>📋</span>
              <span className="font-extrabold" style={{ color: '#D35400', fontFamily: 'Baloo 2, cursive' }}>
                Câu {qIdx + 1}/{initialQuestions.length}
              </span>
            </div>
            <div className="rounded-xl p-3 font-semibold text-base leading-relaxed" style={{ background: '#FFF4D6', color: '#5D4037' }}>
              <MathText>{currentQ?.content || ''}</MathText>
            </div>
            <div className="mt-2 text-xs font-bold" style={{ color: '#FF8C00' }}>
              🔍 Tìm từ: {normalize(currentQ?.correctAnswer || '').split('').join(' · ')}
              <span className="text-slate-400 ml-1">({normalize(currentQ?.correctAnswer || '').length} chữ)</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button onClick={startGame}
              className="flex-1 py-2.5 rounded-xl font-bold text-white shadow transition-all hover:scale-105 text-sm"
              style={{ background: 'linear-gradient(135deg, #FF8C00, #FFB800)' }}>🔄 Chơi lại</button>
            <button onClick={giveHint}
              className="flex-1 py-2.5 rounded-xl font-bold text-white shadow transition-all hover:scale-105 text-sm"
              style={{ background: 'linear-gradient(135deg, #8E44AD, #9B59B6)' }}>💡 Gợi ý</button>
            <button onClick={onBack}
              className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-white shadow hover:bg-slate-50 text-sm">← Thoát</button>
          </div>

          {/* Word list */}
          <div className="rounded-2xl p-4 shadow border-2" style={{ background: 'white', borderColor: '#FFE082' }}>
            <p className="font-bold mb-2 text-sm" style={{ color: '#F57F17' }}>🐝 Từ cần tìm:</p>
            <div className="flex flex-wrap gap-2">
              {initialQuestions.map((q, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: foundWords.has(answers[i]) ? (foundColors.get(answers[i]) || '#2ECC71') : (i === qIdx ? '#FFF4D6' : '#f3f4f6'),
                    color: foundWords.has(answers[i]) ? 'white' : (i === qIdx ? '#D35400' : '#9ca3af'),
                    border: i === qIdx ? '2px solid #FF8C00' : '2px solid transparent',
                    textDecoration: foundWords.has(answers[i]) ? 'line-through' : 'none',
                    opacity: foundWords.has(answers[i]) ? 0.7 : 1,
                  }}>
                  {answers[i] || '?'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Grid */}
        <div className="lg:w-2/3 w-full">
          <div className="rounded-2xl p-4 shadow-xl border-2" style={{ background: 'white', borderColor: '#FFD060' }}>
            <div
              ref={gridRef}
              className="flex flex-col items-center gap-1 select-none"
              onMouseLeave={() => { if (selecting) { setSelecting(false); checkSel(selCells, grid, positions, qIdx, answers); setSelCells([]); } }}
              onMouseUp={onMouseUp}
              onTouchEnd={onMouseUp}
              onTouchMove={onTouchMove}
            >
              {grid.map((row, r) => (
                <div key={r} className="flex gap-1">
                  {row.map((char, c) => (
                    <div
                      key={c}
                      data-row={r}
                      data-col={c}
                      onMouseDown={() => onCellDown(r, c)}
                      onMouseEnter={() => onCellEnter(r, c)}
                      onTouchStart={e => { e.preventDefault(); onCellDown(r, c); }}
                      className="flex items-center justify-center font-bold cursor-pointer rounded-lg transition-all hover:scale-110"
                      style={{
                        width: gridSize > 13 ? 28 : 36,
                        height: gridSize > 13 ? 28 : 36,
                        fontSize: gridSize > 13 ? 11 : 14,
                        userSelect: 'none',
                        ...(isHint(r, c) ? { background: '#FFEB3B', border: '2px solid #F57F17', color: '#3E2723' } : cellStyle(r, c)),
                      }}
                    >
                      {char}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
