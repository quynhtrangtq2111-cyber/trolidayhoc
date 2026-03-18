/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  FileText,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  BookOpen,
  HelpCircle,
  Gamepad2,
  AlertCircle,
  Sigma,
  Settings,
  X,
  KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import VuaTiengVietGame from './VuaTiengVietGame';
import VuotAiTriThucGame from './VuotAiTriThucGame';
import SanKhoBauGame from './SanKhoBauGame';
import BucTranhBiAnGame from './BucTranhBiAnGame';
import OngTimChuGame from './OngTimChuGame';
import TranhTaiKeoCoGame from './TranhTaiKeoCoGame';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Game Library with compatibility mapping
const QUESTION_TYPES = [
  { id: 'Đúng / Sai', label: 'Đúng / Sai', emoji: '✅' },
  { id: 'Trắc nghiệm khách quan', label: 'Trắc nghiệm', emoji: '🔤' },
  { id: 'Trả lời ngắn', label: 'Trả lời ngắn', emoji: '✏️' },
  { id: 'Điền khuyết', label: 'Điền khuyết', emoji: '📝' },
  { id: 'Kéo thả', label: 'Kéo thả', emoji: '🔀' },
];

const GAME_LIBRARY = [
  {
    id: 'default',
    name: 'Quiz Mở Thẻ',
    emoji: '🎴',
    description: 'Trả lời đúng để lật mở từng thẻ bài.',
    compatibleTypes: ['Trắc nghiệm khách quan', 'Đúng / Sai'],
    colorFrom: 'from-indigo-500', colorTo: 'to-violet-500',
    hoverBorder: 'hover:border-indigo-400',
  },
  {
    id: 'vuot_ai',
    name: 'Vượt Ải Tri Thức',
    emoji: '⚔️',
    description: 'Giao diện tối. Trả lời nhanh vượt qua từng ải.',
    compatibleTypes: ['Trắc nghiệm khách quan', 'Đúng / Sai'],
    colorFrom: 'from-sky-500', colorTo: 'to-blue-600',
    hoverBorder: 'hover:border-sky-400',
  },
  {
    id: 'vua_tieng_viet',
    name: 'Vua Tiếng Việt',
    emoji: '👑',
    description: 'Sắp xếp chữ cái trong thời gian giới hạn.',
    compatibleTypes: ['Trả lời ngắn', 'Điền khuyết'],
    colorFrom: 'from-pink-500', colorTo: 'to-rose-500',
    hoverBorder: 'hover:border-pink-400',
  },
  {
    id: 'san_kho_bau',
    name: 'Săn Kho Báu',
    emoji: '🗃️',
    description: 'Thu thập vàng bằng cách trả lời đúng. Hỗ trợ kéo-thả điền khuyết.',
    compatibleTypes: ['Trắc nghiệm khách quan', 'Đúng / Sai', 'Trả lời ngắn', 'Điền khuyết'],
    colorFrom: 'from-amber-500', colorTo: 'to-yellow-600',
    hoverBorder: 'hover:border-amber-400',
  },
  {
    id: 'buc_tranh_bi_an',
    name: 'Bức Tranh Bí Ẩn',
    emoji: '🖼️',
    description: 'Trả lời đúng để lộ dần bức tranh ẩn. Hình ảnh tùy chỉnh.',
    compatibleTypes: ['Trắc nghiệm khách quan', 'Đúng / Sai', 'Trả lời ngắn'],
    colorFrom: 'from-slate-600', colorTo: 'to-slate-800',
    hoverBorder: 'hover:border-yellow-400',
  },
  {
    id: 'ong_tim_chu',
    name: 'Ong Tìm Chữ',
    emoji: '🐝',
    description: 'Tìm đáp án ẩn trong bảng chữ cái. Kéo để chọn, ngang/dọc/chéo.',
    compatibleTypes: ['Trả lời ngắn', 'Điền khuyết'],
    colorFrom: 'from-yellow-400', colorTo: 'to-orange-500',
    hoverBorder: 'hover:border-amber-400',
  },
  {
    id: 'tranh_tai_keo_co',
    name: 'Tranh Tài Kéo Co',
    emoji: '🏆',
    description: '2 đội đấu đả luân phiên, kéo dây về phía chiến thắng!',
    compatibleTypes: ['Trắc nghiệm khách quan', 'Đúng / Sai'],
    colorFrom: 'from-blue-700', colorTo: 'to-red-700',
    hoverBorder: 'hover:border-yellow-400',
  },
];

// Types
type AppStage = 'home' | 'm1_type' | 'm1_input' | 'm1_edit' | 'm1_game' | 'm2_analyze' | 'm2_needs' | 'm2_questions' | 'm2_game';

interface LessonAnalysis {
  subject: string;
  level: string;
  keyConcepts: string[];
  rawText: string;
}

interface TeacherNeeds {
  questionType: string[];
  cognitiveLevel: string[];
  studentLevel: string;
  purpose: string;
  counts: Record<string, number>; // key format: "type|level"
}

interface QuestionItem {
  id: string;
  content: string;
  options?: string[]; // Cho trắc nghiệm
  correctAnswer?: string;
  type: string;
  level: string;
}

const AI_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Mặc định)', icon: '⚡' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', icon: '🧠' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: '🚀' }
];

export default function App() {
  const [stage, setStage] = useState<AppStage>('home');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings & API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].id);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiKeyRequired, setIsApiKeyRequired] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    const storedModel = localStorage.getItem('preferred_ai_model');
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      setIsSettingsOpen(true);
      setIsApiKeyRequired(true);
    }

    if (storedModel && AI_MODELS.some(m => m.id === storedModel)) {
      setSelectedModel(storedModel);
    }
  }, []);

  const saveSettings = (newKey: string, newModel: string) => {
    if (newKey) {
      localStorage.setItem('gemini_api_key', newKey);
      setApiKey(newKey);
      setIsApiKeyRequired(false);
    }
    localStorage.setItem('preferred_ai_model', newModel);
    setSelectedModel(newModel);
    setIsSettingsOpen(false);
  };

  // Stage 1 State
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);

  // Stage 2 State
  const [needs, setNeeds] = useState<TeacherNeeds>({
    questionType: [],
    cognitiveLevel: ['Nhận biết'],
    studentLevel: 'Trung bình',
    purpose: 'Luyện tập',
    counts: {}
  });

  // Mode 1 State
  const [m1QuestionTypes, setM1QuestionTypes] = useState<string[]>([]);
  const [m1RawText, setM1RawText] = useState('');
  const [m1IsExtracting, setM1IsExtracting] = useState(false);
  const [m1FileInfo, setM1FileInfo] = useState<{ name: string; type: string } | null>(null);
  const m1FileInputRef = useRef<HTMLInputElement>(null);

  // Mode 2 / Shared State
  const [questions, setQuestions] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<QuestionItem[]>([]);
  const [activities, setActivities] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const callGeminiWithFallback = async (parts: any[]) => {
    const currentApiKey = apiKey || process.env.GEMINI_API_KEY || '';
    if (!currentApiKey) {
      throw new Error("Vui lòng thiết lập API Key trong phần Cài đặt.");
    }
    const genAI = new GoogleGenAI({ apiKey: currentApiKey });

    // Determine priority list
    const modelsToTry = [selectedModel, ...AI_MODELS.filter(m => m.id !== selectedModel).map(m => m.id)];
    let lastError: any = null;

    for (const modelId of modelsToTry) {
      try {
        const response = await genAI.models.generateContent({
          model: modelId,
          contents: { parts }
        });
        return response.text;
      } catch (err: any) {
        console.warn(`Lỗi khi gọi model ${modelId}:`, err);
        lastError = err;
        // Proceed to next model...
      }
    }

    // If all models failed, throw original error so it's visible to user
    throw new Error(lastError?.message || JSON.stringify(lastError) || "Tất cả các model đều thất bại. Thử lại sau.");
  };

  const compressImage = (dataUrl: string, maxSize = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down if larger than maxSize
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Compress as JPEG
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.src = dataUrl;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const raw = reader.result as string;
        // Compress image to reduce API payload and speed up analysis
        const compressed = await compressImage(raw);
        setSelectedImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const runAnalysis = async () => {
    if (!inputText && !selectedImage) {
      setError('Vui lòng nhập văn bản hoặc tải lên hình ảnh bài học.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const parts: any[] = [
        {
          text: `Bạn là TRỢ LÍ ẢO THIẾT KẾ BÀI HỌC (AI đồng hành). Hãy thực hiện BƯỚC 1: PHÂN TÍCH BÀI HỌC.
        
        Nhiệm vụ: Trích xuất kiến thức chính từ dữ liệu.
        
        Cấu trúc phản hồi:
        ✅ Đã xong bước 1: Phân tích nội dung.
        
        📘 THẺ KIẾN THỨC BÀI HỌC:
        - 🏫 Cấp học: ...
        - 📚 Môn học: ...
        - 🔑 Kiến thức trọng tâm: (Gạch đầu dòng ngắn gọn)
        - ⚗️ Công thức/Quy trình: (Sử dụng LaTeX nếu có)
        
        👉 Tiếp theo, chúng ta sẽ cùng làm rõ nhu cầu của bạn nhé!` }
      ];

      if (inputText) {
        parts.push({ text: `Nội dung văn bản: ${inputText}` });
      }

      if (selectedImage) {
        const base64Data = selectedImage.split(',')[1];
        // Detect MIME type from data URL
        const mimeMatch = selectedImage.match(/^data:(image\/\w+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType
          }
        });
      }

      const text = await callGeminiWithFallback(parts);

      setAnalysis(text || "Không thể phân tích nội dung.");
      setStage('m2_needs');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Đã có lỗi xảy ra trong quá trình phân tích. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateQuestionsAndActivities = async () => {
    if (needs.questionType.length === 0) {
      setError('Vui lòng chọn ít nhất một dạng câu hỏi.');
      return;
    }
    if (needs.cognitiveLevel.length === 0) {
      setError('Vui lòng chọn ít nhất một mức độ nhận thức.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const countDetails = Object.entries(needs.counts)
        .filter(([key, val]) => val > 0)
        .map(([key, val]) => {
          const [type, level] = key.split('|');
          return `- ${type} [${level}]: ${val} câu`;
        })
        .join('\n');

      const prompt = `Bạn là TRỢ LÍ ẢO THIẾT KẾ BÀI HỌC (AI đồng hành). 
      Dựa trên nội dung bài học: ${analysis}
      
      Hãy thực hiện BƯỚC 3: SINH HỆ THỐNG CÂU HỎI và BƯỚC 4: GỢI Ý HOẠT ĐỘNG.
      
      Lựa chọn của giáo viên:
      - Dạng câu hỏi: ${needs.questionType.join(', ')}
      - Mức độ: ${needs.cognitiveLevel.join(', ')}
      - Học sinh: ${needs.studentLevel}
      - Mục đích: ${needs.purpose}
      - Số lượng: ${countDetails}

      Cấu trúc phản hồi BẮT BUỘC:
      
      ✅ Đã xong bước 2: Xác định nhu cầu.
      👉 Tiếp theo, chúng ta sẽ đến với hệ thống câu hỏi và hoạt động!

      ### 🎯 BƯỚC 3: HỆ THỐNG CÂU HỎI
      - Tạo đúng số lượng và định dạng.
      - QUAN TRỌNG: Bạn PHẢI trả về danh sách câu hỏi dưới định dạng mã JSON. Hãy bọc mã JSON này trong block \`\`\`json ... \`\`\`.
      - Cấu trúc JSON mong muốn là một mảng các đối tượng: 
      [
        {
          "id": "q1",
          "content": "Nội dung câu hỏi...",
          "options": ["Nội dung đáp án A", "Nội dung đáp án B", "Nội dung đáp án C", "Nội dung đáp án D"],
          "correctAnswer": "A",
          "type": "Trắc nghiệm khách quan",
          "level": "Nhận biết"
        }
      ]
      - LUẦN TUÂN THỦ: Options KHÔNG có chữ cái đầu (A., B., C.) — chỉ ghi thuần nội dung.
      - Công thức hóa học/toán học PHẢI dùng LaTeX bọc trong $...$. Ví dụ: $C_6H_{12}O_6$, $H_2O$.

      ### 🎮 BƯỚC 4: GỢI Ý HOẠT ĐỘNG HỌC TẬP
      
      🤖 HƯỚNG 1: HOẠT ĐỘNG TRỰC TIẾP (XU HƯỚNG HIỆN ĐẠI)
      - Gợi ý 2-3 hoạt động cuốn hút (như đóng vai, tranh biện, trạm học tập, giải mã).
      - Mỗi hoạt động: Tên bắt tai, Mục tiêu, Cách tổ chức sáng tạo.

      🌐 HƯỚNG 2: TRÒ CHƠI TƯƠNG TÁC SỐ & GEN Z
      - Gợi ý các trò chơi mang tính xu hướng (như Escape room, thi đấu xếp hạng) trên Kahoot, Quizizz, Blooket, Wordwall.
      - Mỗi trò chơi: Tên trò chơi, Mô tả ý tưởng kịch bản hấp dẫn ứng dụng kiến thức bài học, format dễ dàng để giáo viên tự tạo trên nền tảng.

      Ngôn ngữ thân thiện, ngắn gọn, tích cực. Sử dụng biểu tượng 📘 🎯 🎮 🤖.`;

      const text = await callGeminiWithFallback([{ text: prompt }]);

      const fullText = text || "";
      setQuestions(fullText);
      setStage('m2_questions');
      
      // Parse JSON from fullText
      const jsonMatch = fullText.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (Array.isArray(parsed)) {
            setParsedQuestions(applyLatexToQuestions(parsed));
          }
        } catch (e) {
          console.error("Lỗi parse JSON câu hỏi:", e);
        }
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Đã có lỗi xảy ra khi tạo câu hỏi. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionChange = (id: string, field: string, value: any, optionIndex?: number) => {
    setParsedQuestions(prev => prev.map(q => {
      if (q.id === id) {
        if (field === 'options' && optionIndex !== undefined && q.options) {
          const newOptions = [...q.options];
          newOptions[optionIndex] = value;
          return { ...q, options: newOptions };
        }
        return { ...q, [field]: value };
      }
      return q;
    }));
  };

  const removeQuestion = (id: string) => {
    setParsedQuestions(prev => prev.filter(q => q.id !== id));
  };
  
  const addQuestion = () => {
    const newId = `q${Date.now()}`;
    setParsedQuestions(prev => [...prev, {
      id: newId,
      content: '',
      type: needs.questionType[0] || 'Trắc nghiệm khách quan',
      level: needs.cognitiveLevel[0] || 'Nhận biết',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A'
    }]);
  };

  /**
   * Auto-convert plain chemical/math patterns to LaTeX if not already wrapped.
   * e.g.  C6H12O6  →  $C_6H_{12}O_6$
   *       (C6H10O5)n → $(C_6H_{10}O_5)_n$
   *       10^-10   →  $10^{-10}$
   */
  const autoLatex = (text: string): string => {
    if (!text) return text;
    // Chemical formula: sequences like C6H12O6, Fe2O3, H2SO4, (C6H10O5)n etc.
    // We match only formulas NOT already inside $...$
    return text.replace(
      /(?<!\$)\b([A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+(?:\([A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)*\)\d*)*)(?!\w)(?![^$]*\$)/g,
      (match) => {
        // Skip if match is already wrapped in $
        if (text.includes(`$${match}$`)) return match;
        // Convert e.g. C6H12O6 → C_6H_{12}O_6
        const latex = match
          .replace(/\(([^)]+)\)(\d+)/g, '($1)_{$2}') // (C6H10O5)n → (C6H10O5)_{n}
          .replace(/([A-Za-z])([0-9]+)/g, (_, l, n) => n.length > 1 ? `${l}_{${n}}` : `${l}_${n}`);
        return `$${latex}$`;
      }
    );
  };

  // Apply autoLatex to all fields in a question array
  const applyLatexToQuestions = (qs: any[]): any[] => qs.map(q => ({
    ...q,
    content: autoLatex(q.content || ''),
    options: (q.options || []).map((o: string) => {
      // Strip leading letter prefix like "A. ", "B) ", "A - " if present
      const stripped = o.replace(/^[A-Da-d][.)\-–]\s*/u, '').trim();
      return autoLatex(stripped);
    }),
    correctAnswer: autoLatex(q.correctAnswer || ''),
  }));

  // Load mammoth.js from CDN (for DOCX extraction)
  const loadMammoth = (): Promise<any> => new Promise((resolve, reject) => {
    const w = window as any;
    if (w.mammoth) { resolve(w.mammoth); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    script.onload = () => resolve(w.mammoth);
    script.onerror = () => reject(new Error('Không tải được thư viện đọc Word.'));
    document.head.appendChild(script);
  });

  // Extract text from DOCX (mammoth CDN) or PDF (Gemini inline base64)
  const extractTextFromFile = async (file: File) => {
    setM1IsExtracting(true); setError(null);
    try {
      let extractedText = '';

      if (file.name.toLowerCase().endsWith('.docx')) {
        // ── DOCX: use mammoth.js from CDN ──
        const mammoth = await loadMammoth();
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value || '';
        if (!extractedText.trim()) throw new Error('File Word không có nội dung văn bản.');

      } else {
        // ── PDF: use Gemini inline base64 (natively supported) ──
        const currentApiKey = apiKey || process.env.GEMINI_API_KEY || '';
        if (!currentApiKey) { setError('Vui lòng thiết lập API Key trước.'); return; }
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${currentApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: 'Hãy trích xuất TOÀN BỘ nội dung văn bản từ tài liệu PDF này (câu hỏi, đáp án, v.v.). Giữ nguyên cấu trúc, đánh số. Chỉ trả về văn bản thuần túy.' },
                  { inlineData: { mimeType: 'application/pdf', data: base64 } }
                ]
              }]
            })
          }
        );
        const result = await response.json();
        extractedText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!extractedText) throw new Error('Không thể trích xuất nội dung từ PDF.');
      }

      setM1RawText(extractedText);
      setM1FileInfo({ name: file.name, type: file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'docx' });
    } catch (e: any) {
      setError(e.message || 'Lỗi khi đọc tệp. Vui lòng thử lại.');
    } finally {
      setM1IsExtracting(false);
    }
  };

  const parseM1QuestionsWithAI = async () => {
    if (!m1RawText.trim()) { setError('Vui lòng nhập nội dung câu hỏi.'); return; }
    setIsLoading(true); setError(null);
    try {
      const prompt = `Bạn là trợ lý giáo dục. Hãy phân tích đoạn văn bản câu hỏi sau và trả về ĐÚNG định dạng JSON.
Dạng câu hỏi: ${m1QuestionTypes.join(', ')}.

QUAN TRỌNG VỀ ĐỊNH DẠNG CÔNG THỨC:
- Mọi công thức hóa học (C6H12O6, H2SO4, Fe2O3...) và toán học PHẢI được bọc trong ký tự $ định dạng LaTeX.
- Ví dụ: C6H12O6 → $C_6H_{12}O_6$  |  H2O → $H_2O$  |  10^-10 → $10^{-10}$
- Đây là YÊU CẦU BẮT BUỘC, không bỏ qua.

Văn bản:
${m1RawText}

Trả về JSON bọc trong \`\`\`json ... \`\`\`, là một mảng:
[{"id":"q1","content":"...","options":["$C_6H_{12}O_6$","$(C_6H_{10}O_5)_n$","$C_{12}H_{22}O_{11}$","$C_6H_{12}O_6$"],"correctAnswer":"A","type":"Trắc nghiệm khách quan","level":"Nhận biết"}]
LƯU Ý QUAN TRỌNG: Options KHÔNG được có chữ cái đầu (A., B., C., D.) — chỉ ghi NỘI DUNG đáp án.
correctAnswer phải là "A", "B", "C", "D" (vị trí trong mảng options).
Nếu là câu Đúng/Sai: options=["Đúng","Sai"], correctAnswer="Đúng" hoặc "Sai".
Nếu là Trả lời ngắn/Điền khuyết: bỏ options, correctAnswer là đáp án.`;
      const text = await callGeminiWithFallback([{ text: prompt }]);
      const jsonMatch = (text || '').match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch?.[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) { setParsedQuestions(applyLatexToQuestions(parsed)); setStage('m1_edit'); return; }
      }
      setError('Không thể phân tích. Hãy thử lại hoặc chỉnh sửa thủ công.');
    } catch (e: any) { setError(e.message || 'Lỗi phân tích câu hỏi.'); }
    finally { setIsLoading(false); }
  };

  const reset = () => {
    setStage('home');
    setInputText(''); setSelectedImage(null); setAnalysis(null);
    setQuestions(null); setParsedQuestions([]); setActivities(null);
    setError(null); setSelectedGameId(null);
    setM1QuestionTypes([]); setM1RawText('');
  };

  const getQuestionsPart = () => {
    if (!questions) return '';
    const parts = questions.split('### 🎮 BƯỚC 4');
    return parts[0] || questions;
  };

  const getActivitiesPart = () => {
    if (!questions) return '';
    const parts = questions.split('### 🎮 BƯỚC 4');
    if (!parts[1]) return 'Đang chuẩn bị các hoạt động thú vị cho bạn...';

    return `### 🎮 BƯỚC 4${parts[1]}`;
  };

  return (
    <div className="min-h-screen mesh-bg text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-white/20">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Gamepad2 size={22} />
            </div>
            <h1 className="font-bold text-lg tracking-tight gradient-text hidden sm:block">Trợ lý Tạo Trò Chơi AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <StageIndicator currentStage={stage} />
            </div>
            {stage !== 'home' && (
              <button onClick={reset} className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                <RefreshCw size={14} /> Trang chủ
              </button>
            )}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-all"
            >
              <Settings size={16} className="text-slate-600" />
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-700 leading-tight">Cài đặt API</div>
                <div className="text-[10px] font-semibold text-red-500 leading-tight">Lấy API key để sử dụng</div>
              </div>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {/* HOME SCREEN */}
          {stage === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
              <div className="text-center space-y-4 py-8">
                <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold border border-indigo-100">
                  <Gamepad2 size={16} /> Trợ lý thiết kế hoạt động dạy học
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
                  Tạo Trò Chơi<br />
                  <span className="gradient-text">Học Tập Bằng AI</span>
                </h2>
                <p className="text-slate-500 text-lg max-w-xl mx-auto">Chọn cách bạn muốn mình giúp để bắt đầu nhé!</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* Mode 1 Card */}
                <motion.div whileHover={{ scale: 1.02, y: -4 }} onClick={() => setStage('m1_type')}
                  className="glass-card p-8 rounded-3xl cursor-pointer border-2 border-transparent hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-100 transition-all group"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-white text-2xl mb-5 shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
                    📄
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Tôi đã có câu hỏi</h3>
                  <p className="text-slate-500 text-sm mb-5">Dành cho giáo viên đã có bộ câu hỏi. Hệ thống sẽ gợi ý trò chơi phù hợp và đưa câu hỏi vào trò chơi tương tác.</p>
                  <div className="space-y-2">
                    {['✅ Chọn dạng câu hỏi đang có', '📋 Dán hoặc nhập câu hỏi', '🎮 Hệ thống gợi ý trò chơi phù hợp', '▶️ Chơi thử ngay!'].map(s => (
                      <div key={s} className="text-xs text-slate-400 flex items-center gap-2">{s}</div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-emerald-600 font-bold text-sm">
                    Bắt đầu <ChevronRight size={16} />
                  </div>
                </motion.div>

                {/* Mode 2 Card */}
                <motion.div whileHover={{ scale: 1.02, y: -4 }} onClick={() => { if (!apiKey) { setIsSettingsOpen(true); setIsApiKeyRequired(true); } else setStage('m2_analyze'); }}
                  className="glass-card p-8 rounded-3xl cursor-pointer border-2 border-transparent hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100 transition-all group"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white text-2xl mb-5 shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                    🤖
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">AI tạo câu hỏi</h3>
                  <p className="text-slate-500 text-sm mb-5">Dành cho giáo viên chưa có câu hỏi. AI sẽ phân tích bài học và tạo câu hỏi theo ý muốn của bạn.</p>
                  <div className="space-y-2">
                    {['📚 Nhập nội dung bài học / ảnh', '🤖 AI phân tích đầu bài', '❓ Chọn dạng, mức độ, số lượng', '🎮 AI sinh câu hỏi → chỉnh sửa → chơi!'].map(s => (
                      <div key={s} className="text-xs text-slate-400 flex items-center gap-2">{s}</div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    Bắt đầu <ChevronRight size={16} />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* M1_TYPE: Select question types */}
          {stage === 'm1_type' && (
            <motion.div key="m1_type" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-3xl mx-auto space-y-8">
              <div>
                <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-4"><ChevronRight size={14} className="rotate-180" /> Quay lại</button>
                <h2 className="text-3xl font-black">Bạn đang có dạng câu hỏi nào? 💡</h2>
                <p className="text-slate-500 mt-2">Chọn tối đa <strong>3 dạng</strong> — hệ thống sẽ gợi ý trò chơi phù hợp.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {QUESTION_TYPES.map(qt => {
                  const selected = m1QuestionTypes.includes(qt.id);
                  const disabled = !selected && m1QuestionTypes.length >= 3;
                  const compatibleGames = GAME_LIBRARY.filter(g => g.compatibleTypes.includes(qt.id));
                  return (
                    <button key={qt.id}
                      disabled={disabled}
                      onClick={() => setM1QuestionTypes(prev => selected ? prev.filter(t => t !== qt.id) : [...prev, qt.id])}
                      className={cn(
                        'p-5 rounded-2xl border-2 text-left transition-all',
                        selected ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100' : disabled ? 'border-slate-100 opacity-40 cursor-not-allowed' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                      )}
                    >
                      <div className="text-3xl mb-2">{qt.emoji}</div>
                      <div className={cn('font-bold', selected ? 'text-indigo-700' : 'text-slate-700')}>{qt.label}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{compatibleGames.map(g => g.name).join(' · ')}</div>
                    </button>
                  );
                })}
              </div>

              {m1QuestionTypes.length > 0 && (
                <div className="glass-card p-5 rounded-2xl">
                  <p className="text-sm font-semibold text-slate-600 mb-3">🎮 Trò chơi phù hợp với bộ câu hỏi của bạn:</p>
                  <div className="flex flex-wrap gap-3">
                    {GAME_LIBRARY.filter(g => m1QuestionTypes.some(t => g.compatibleTypes.includes(t))).map(g => (
                      <div key={g.id} className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold bg-gradient-to-r', g.colorFrom, g.colorTo)}>
                        <span>{g.emoji}</span><span>{g.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setStage('m1_input')}
                  disabled={m1QuestionTypes.length === 0}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
                >
                  <ChevronRight size={20} /> Tiếp theo: Nhập câu hỏi
                </button>
              </div>
            </motion.div>
          )}

          {/* M1_INPUT: Paste questions */}
          {stage === 'm1_input' && (
            <motion.div key="m1_input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-3xl mx-auto space-y-6">
              <div>
                <button onClick={() => setStage('m1_type')} className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-4"><ChevronRight size={14} className="rotate-180" /> Quay lại chọn dạng</button>
                <h2 className="text-3xl font-black">Nhập câu hỏi 📋</h2>
                <p className="text-slate-500 mt-1">Tải file Word/PDF hoặc dán trực tiếp — AI sẽ phân tích cấu trúc ({m1QuestionTypes.join(', ')}).</p>
              </div>

              {/* File upload area */}
              <div
                className={cn('glass-card p-6 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[120px]',
                  m1IsExtracting ? 'border-indigo-400 bg-indigo-50/50' : m1FileInfo ? 'border-emerald-400 bg-emerald-50/30' : 'border-indigo-200/60 hover:border-indigo-400 hover:bg-indigo-50/20'
                )}
                onClick={() => !m1IsExtracting && m1FileInputRef.current?.click()}
              >
                <input
                  ref={m1FileInputRef}
                  type="file"
                  className="hidden"
                  accept=".docx,.pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) { setM1RawText(''); setM1FileInfo(null); await extractTextFromFile(file); }
                    e.target.value = '';
                  }}
                />
                {m1IsExtracting ? (
                  <>
                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                    <p className="text-indigo-600 font-semibold text-sm">AI đang đọc và trích xuất câu hỏi từ tệp...</p>
                  </>
                ) : m1FileInfo ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 text-xl">
                        {m1FileInfo.type.includes('pdf') ? '📄' : '📝'}
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-700 text-sm">{m1FileInfo.name}</p>
                        <p className="text-xs text-emerald-500">✅ Đã trích xuất thành công — văn bản hiển thị bên dưới</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setM1FileInfo(null); setM1RawText(''); }}
                        className="ml-auto p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-2xl flex items-center justify-center text-2xl">📂</div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-700">Tải lên file Word hoặc PDF</p>
                      <p className="text-xs text-slate-400 mt-1">Hỗ trợ <strong>.docx</strong> và <strong>.pdf</strong> · AI sẽ tự đọc và trích xuất</p>
                    </div>
                    <span className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-full shadow hover:bg-indigo-700 transition-colors">Chọn tệp</span>
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">hoặc dán văn bản thủ công</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Textarea */}
              <div className="glass-card p-6 rounded-3xl">
                <textarea
                  className="w-full h-56 p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"
                  placeholder={`Dán câu hỏi vào đây...\nVí dụ:\nCâu 1: Nguyên tử là gì?\nA. Hạt nhân nhỏ\nB. Khối cầu rắt\nĐáp án: B\n...`}
                  value={m1RawText}
                  onChange={e => setM1RawText(e.target.value)}
                />
                {m1RawText.trim() && (
                  <p className="text-xs text-slate-400 mt-2">{m1RawText.split('\n').filter(l => l.trim()).length} dòng · {m1RawText.length.toLocaleString()} ký tự</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <button
                  onClick={() => { setParsedQuestions([]); setStage('m1_edit'); }}
                  className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50"
                >
                  Nhập thủ công
                </button>
                <button
                  onClick={parseM1QuestionsWithAI}
                  disabled={isLoading || m1IsExtracting || !m1RawText.trim()}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-lg shadow-indigo-200"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  Phân tích với AI
                </button>
              </div>
            </motion.div>
          )}

          {/* M2_ANALYZE: Input lesson */}
          {stage === 'm2_analyze' && (
            <motion.div key="m2_analyze" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 mx-auto mb-2"><ChevronRight size={14} className="rotate-180" /> Trang chủ</button>
                <h2 className="text-3xl font-bold text-slate-900">🤖 Bước 1: Nhập nội dung bài học</h2>
                <p className="text-slate-500">Nhập văn bản hoặc tải ảnh, AI sẽ phân tích kiến thức chính.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-3xl">
                  <div className="flex items-center gap-2 mb-4 text-indigo-600"><FileText size={20} /><span className="font-semibold">Nội dung bài học</span></div>
                  <textarea className="w-full h-64 p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm" placeholder="Dán nội dung bài học tại đây..." value={inputText} onChange={e => setInputText(e.target.value)} />
                </div>
                <div className={cn('glass-card p-6 rounded-3xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-4 transition-all', selectedImage ? 'border-indigo-500 bg-indigo-50/30' : 'border-indigo-200/50 hover:border-indigo-400')} onClick={() => fileInputRef.current?.click()}>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  {selectedImage ? (
                    <div className="relative w-full flex items-center justify-center">
                      <img src={selectedImage} alt="Preview" className="max-h-56 rounded-lg shadow-sm" />
                      <button onClick={e => { e.stopPropagation(); setSelectedImage(null); }} className="absolute top-1 right-1 p-1 bg-white rounded-full shadow hover:text-red-500"><RefreshCw size={14} /></button>
                    </div>
                  ) : (
                    <><div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"><ImageIcon size={24} /></div><div className="text-center"><p className="font-medium">Tải lên hình ảnh</p><p className="text-xs text-slate-400 mt-1">Hỗ trợ JPG, PNG, WEBP</p></div></>
                  )}
                </div>
              </div>
              <div className="flex justify-center">
                <button onClick={runAnalysis} disabled={isLoading || (!inputText && !selectedImage)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight size={20} />} Phân tích bài học
                </button>
              </div>
            </motion.div>
          )}

          {/* M2_NEEDS: Teacher needs form */}
          {stage === 'm2_needs' && (
            <motion.div
              key="stage2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Analysis Result */}
              <div className="lg:col-span-1 space-y-6">
                <div className="glass-card p-6 rounded-3xl">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-500" size={20} />
                    📘 Bước 1: Thẻ kiến thức
                  </h3>
                  <div className="prose prose-slate prose-sm max-w-none">
                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {analysis || ''}
                    </Markdown>
                  </div>
                  <button
                    onClick={() => setStage('m2_analyze')}
                    className="mt-6 text-sm text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={14} /> Làm lại bước 1
                  </button>
                </div>
              </div>

              {/* Needs Form */}
              <div className="lg:col-span-2 space-y-6">
                <div className="glass-card p-8 rounded-3xl space-y-8">
                  <h3 className="text-xl font-bold">🎯 Bước 2: Xác định nhu cầu</h3>
                  <p className="text-sm text-slate-500">Bạn muốn mình tạo câu hỏi như thế nào nhỉ? Hãy chọn các thẻ bên dưới nhé!</p>
                  {/* Question Types */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">1. Dạng câu hỏi mong muốn? <span className="text-xs font-normal text-slate-400">(Tối đa 2)</span></label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {['Đúng / Sai', 'Trắc nghiệm khách quan', 'Trả lời ngắn', 'Điền khuyết', 'Kéo thả'].map(type => (
                        <button
                          key={type}
                          disabled={!needs.questionType.includes(type) && needs.questionType.length >= 2}
                          onClick={() => {
                            const newTypes = needs.questionType.includes(type)
                              ? needs.questionType.filter(t => t !== type)
                              : needs.questionType.length < 2 ? [...needs.questionType, type] : needs.questionType;
                            setNeeds({ ...needs, questionType: newTypes });
                          }}
                          className={cn(
                            "px-4 py-2 rounded-lg border text-sm transition-all text-left",
                            needs.questionType.includes(type)
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-medium"
                              : !needs.questionType.includes(type) && needs.questionType.length >= 2
                                ? "border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50"
                                : "border-slate-200 hover:border-slate-300 text-slate-600"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cognitive Level */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sigma size={16} className="text-indigo-600" />
                      <label className="text-sm font-semibold text-slate-700">2. Mức độ nhận thức? (Có thể chọn nhiều)</label>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {['Nhận biết', 'Thông hiểu', 'Vận dụng'].map(level => {
                        const isSelected = needs.cognitiveLevel.includes(level);
                        const colors: Record<string, string> = {
                          'Nhận biết': isSelected ? 'bg-emerald-100 border-emerald-500 text-emerald-800 shadow-sm shadow-emerald-200' : 'bg-emerald-50/50 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300',
                          'Thông hiểu': isSelected ? 'bg-amber-100 border-amber-500 text-amber-800 shadow-sm shadow-amber-200' : 'bg-amber-50/50 border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300',
                          'Vận dụng': isSelected ? 'bg-rose-100 border-rose-500 text-rose-800 shadow-sm shadow-rose-200' : 'bg-rose-50/50 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300'
                        };
                        return (
                          <button
                            key={level}
                            onClick={() => {
                              const newLevels = isSelected
                                ? needs.cognitiveLevel.filter(l => l !== level)
                                : [...needs.cognitiveLevel, level];
                              setNeeds({ ...needs, cognitiveLevel: newLevels });
                            }}
                            className={cn(
                              "px-5 py-3 rounded-xl border-2 text-sm font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                              colors[level]
                            )}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Student Level */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">3. Đối tượng học sinh?</label>
                    <div className="flex flex-wrap gap-3">
                      {['Yếu', 'Trung bình', 'Khá – Giỏi'].map(level => (
                        <button
                          key={level}
                          onClick={() => setNeeds({ ...needs, studentLevel: level })}
                          className={cn(
                            "px-4 py-2 rounded-lg border text-sm transition-all",
                            needs.studentLevel === level
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-medium"
                              : "border-slate-200 hover:border-slate-300 text-slate-600"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Purpose */}
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">4. Mục đích sử dụng?</label>
                    <div className="flex flex-wrap gap-3">
                      {['Khởi động', 'Hình thành kiến thức', 'Luyện tập', 'Củng cố cuối bài', 'Kiểm tra nhanh'].map(p => (
                        <button
                          key={p}
                          onClick={() => setNeeds({ ...needs, purpose: p })}
                          className={cn(
                            "px-4 py-2 rounded-lg border text-sm transition-all",
                            needs.purpose === p
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-medium"
                              : "border-slate-200 hover:border-slate-300 text-slate-600"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Counts Matrix */}
                  {needs.questionType.length > 0 && needs.cognitiveLevel.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <HelpCircle size={16} className="text-indigo-600" />
                        <label className="text-sm font-semibold text-slate-700">5. Số lượng câu hỏi chi tiết</label>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                        {needs.questionType.map(type => (
                          <div key={type} className="space-y-2">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{type}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {needs.cognitiveLevel.map(level => {
                                const key = `${type}|${level}`;
                                return (
                                  <div key={level} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                                    <span className="text-xs text-slate-600">{level}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      className="w-12 text-right text-sm font-bold text-indigo-600 outline-none"
                                      value={needs.counts[key] || 0}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setNeeds({
                                          ...needs,
                                          counts: { ...needs.counts, [key]: val }
                                        });
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={generateQuestionsAndActivities}
                      disabled={isLoading || needs.questionType.length === 0 || needs.cognitiveLevel.length === 0}
                      className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                    >
                      {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                      👉 Tiếp theo: Sinh câu hỏi & Hoạt động!
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* M1_EDIT & M2_QUESTIONS: Question editor + activities */}
          {(stage === 'm1_edit' || stage === 'm2_questions') && (
            <motion.div
              key="stage3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{stage === 'm1_edit' ? '✏️ Chỉnh sửa câu hỏi' : '🤖 Kết quả đồng hành cùng bạn'}</h2>
                  <p className="text-slate-500">{stage === 'm1_edit' ? 'Kiểm tra lại câu hỏi và chỉnh sửa nếu cần nhé.' : 'Mọi thứ đã sẵn sàng! Bạn có thể xem và chỉnh sửa nhé.'}</p>
                </div>
                <button
                  onClick={reset}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
                >
                  <RefreshCw size={16} /> Bắt đầu hành trình mới
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Questions */}
                <div className="glass-card p-8 rounded-3xl space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-violet-500 rounded-l-3xl"></div>
                  <div className="flex items-center gap-2 text-indigo-600 mb-6">
                    <HelpCircle size={24} />
                    <h3 className="text-xl font-bold">🎯 Bước 3: Chỉnh sửa Câu hỏi</h3>
                  </div>
                  
                  {parsedQuestions.length > 0 ? (
                    <div className="space-y-6">
                      {parsedQuestions.map((q, idx) => (
                        <div key={q.id} className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm relative group">
                          <button 
                            onClick={() => removeQuestion(q.id)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={16} />
                          </button>
                          
                          <div className="flex items-center gap-3 mb-3">
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs">Câu {idx + 1}</span>
                            <span className="text-xs text-slate-500">{q.type} - {q.level}</span>
                          </div>

                          <textarea
                            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none text-sm mb-3 font-medium"
                            value={q.content}
                            onChange={(e) => handleQuestionChange(q.id, 'content', e.target.value)}
                            rows={3}
                            placeholder="Nội dung câu hỏi..."
                          />

                          {q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              {q.options.map((opt, oIdx) => (
                                <div key={oIdx} className="flex flex-col gap-1 text-sm">
                                  <span className="text-xs text-slate-500 font-medium">Đáp án {['A', 'B', 'C', 'D'][oIdx]}</span>
                                  <input
                                    type="text"
                                    className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={opt}
                                    onChange={(e) => handleQuestionChange(q.id, 'options', e.target.value, oIdx)}
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Correct answer: select if has options, text input otherwise */}
                          {q.options && q.options.length > 0 ? (
                            <div className="flex items-center gap-2 text-sm mt-3 pt-3 border-t border-slate-100">
                              <span className="font-semibold text-emerald-600">Đáp án đúng:</span>
                              <select 
                                value={q.correctAnswer}
                                onChange={(e) => handleQuestionChange(q.id, 'correctAnswer', e.target.value)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-emerald-50 text-emerald-700 outline-none"
                              >
                                {q.options.map((opt, oIdx) => (
                                  <option key={oIdx} value={['A', 'B', 'C', 'D'][oIdx]}>
                                    {['A', 'B', 'C', 'D'][oIdx]}: {opt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm mt-3 pt-3 border-t border-slate-100">
                              <span className="font-semibold text-emerald-600 shrink-0">Đáp án đúng:</span>
                              <input
                                type="text"
                                className="flex-1 p-1.5 rounded-lg border border-slate-200 bg-emerald-50 text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-400"
                                placeholder="Nhập đáp án..."
                                value={q.correctAnswer || ''}
                                onChange={(e) => handleQuestionChange(q.id, 'correctAnswer', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      
                      <button 
                        onClick={addQuestion}
                        className="w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50 hover:border-indigo-400 transition-all"
                      >
                        + Thêm câu hỏi
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-500">
                      Không thể trích xuất dưới dạng chỉnh sửa được. Hãy xem kết quả gốc bên dưới.
                      <div className="prose prose-indigo prose-sm mt-4 text-left">
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {getQuestionsPart()}
                        </Markdown>
                      </div>
                    </div>
                  )}

                  {/* Game Launch Section */}
                  {parsedQuestions.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-indigo-100">
                       <button
                         onClick={() => {
                            setStage(stage === 'm1_edit' ? 'm1_game' : 'm2_game');
                            setSelectedGameId(null);
                         }}
                         className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-indigo-300 hover:-translate-y-1 transition-all"
                       >
                         <Gamepad2 size={24} />
                         Lưu & Chơi thử Game
                       </button>
                    </div>
                  )}
                </div>

                {/* Activities */}
                <div className="glass-card p-8 rounded-3xl space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 to-teal-500 rounded-r-3xl"></div>
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Gamepad2 size={24} />
                    <h3 className="text-xl font-bold">🎮 Bước 4: Hoạt động học tập</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="prose prose-emerald prose-sm max-w-none bg-white/70 p-6 rounded-2xl border border-emerald-100 shadow-inner backdrop-blur-sm">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {getActivitiesPart()}
                      </Markdown>
                    </div>
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                      <AlertCircle className="text-amber-500 shrink-0" size={20} />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>Lưu ý:</strong> Hãy luôn kiểm tra lại nội dung trước khi sử dụng trong lớp học để đảm bảo tính chính xác tuyệt đối.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* GAME SELECTOR: m1_game / m2_game */}
          {(stage === 'm1_game' || stage === 'm2_game') && (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              {!selectedGameId ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold flex items-center gap-3"><Gamepad2 className="text-violet-600" size={32} />Chọn Trò Chơi 🎮</h2>
                      <p className="text-slate-500 mt-2">{stage === 'm1_game' ? 'Chỉ hiển các trò chơi phù hợp với dạng câu hỏi bạn đã chọn.' : 'Chọn một trò chơi để tích hợp với câu hỏi AI vừa tạo.'}</p>
                    </div>
                    <button
                      onClick={() => setStage(stage === 'm1_game' ? 'm1_edit' : 'm2_questions')}
                      className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <ChevronRight size={16} className="rotate-180" /> Quay lại chỉnh sửa
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {GAME_LIBRARY.filter(g => {
                      const activeTypes = stage === 'm1_game'
                        ? m1QuestionTypes
                        : [...new Set(parsedQuestions.map(q => q.type))];
                      return activeTypes.length === 0 || activeTypes.some(t => g.compatibleTypes.includes(t));
                    }).map(g => (
                      <div
                        key={g.id}
                        onClick={() => setSelectedGameId(g.id)}
                        className={cn('glass-card p-6 rounded-3xl cursor-pointer border-2 border-transparent transition-all group', g.hoverBorder, 'hover:shadow-lg')}
                      >
                        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform bg-gradient-to-br text-white', g.colorFrom, g.colorTo)}>
                          {g.emoji}
                        </div>
                        <h3 className="text-xl font-bold mb-2">{g.name}</h3>
                        <p className="text-sm text-slate-500">{g.description}</p>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {g.compatibleTypes.map(t => <span key={t} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full h-full min-h-[600px]">
                  {selectedGameId === 'default' && (
                    <div className="glass-card rounded-3xl p-8 bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 text-white min-h-[500px] relative">
                      <button
                        onClick={() => setSelectedGameId(null)}
                        className="absolute top-4 left-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                      >
                        <ChevronRight size={16} className="rotate-180" /> Đổi Game
                      </button>
                      <div className="mt-8 h-full">
                        {parsedQuestions.length > 0 ? (
                          <GameComponent questions={parsedQuestions} />
                        ) : (
                          <div className="flex items-center justify-center h-full text-white/50">
                            Chưa có câu hỏi nào để hiển thị trong game.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedGameId === 'vuot_ai' && (
                    <VuotAiTriThucGame 
                      initialQuestions={parsedQuestions.map(q => ({
                        ...q,
                        options: q.options || ['Đúng', 'Sai']
                      }))} 
                      onBack={() => setSelectedGameId(null)} 
                    />
                  )}
                  {selectedGameId === 'vua_tieng_viet' && (
                    <VuaTiengVietGame 
                      initialQuestions={parsedQuestions.map(q => {
                        let answer = q.correctAnswer || (q.options ? q.options[0] : 'ĐÁP ÁN');
                        if (['A', 'B', 'C', 'D'].includes(answer) && q.options) {
                           const idx = ['A', 'B', 'C', 'D'].indexOf(answer);
                           if (idx >= 0 && q.options[idx]) answer = q.options[idx];
                        }
                        return {
                          text: q.content, answer,
                          scrambled: answer.split('').sort(() => Math.random() - 0.5).join('').toUpperCase(),
                          image: null
                        };
                      })} 
                      onBack={() => setSelectedGameId(null)} 
                    />
                  )}
                  {selectedGameId === 'san_kho_bau' && (
                    <SanKhoBauGame
                      initialQuestions={parsedQuestions}
                      onBack={() => setSelectedGameId(null)}
                    />
                  )}
                  {selectedGameId === 'buc_tranh_bi_an' && (
                    <BucTranhBiAnGame
                      initialQuestions={parsedQuestions}
                      onBack={() => setSelectedGameId(null)}
                    />
                  )}
                  {selectedGameId === 'ong_tim_chu' && (
                    <OngTimChuGame
                      initialQuestions={parsedQuestions}
                      onBack={() => setSelectedGameId(null)}
                    />
                  )}
                  {selectedGameId === 'tranh_tai_keo_co' && (
                    <TranhTaiKeoCoGame
                      initialQuestions={parsedQuestions}
                      onBack={() => setSelectedGameId(null)}
                    />
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-red-600/95 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl flex items-start gap-3 z-[100] border border-red-500/50"
            >
              <AlertCircle size={24} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-sm mb-1">Lỗi hệ thống</p>
                <p className="text-xs leading-relaxed opacity-90 break-words">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors shrink-0">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                      <Settings size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Cấu hình hệ thống</h2>
                      <p className="text-xs text-slate-500">Thiết lập API Key và Model AI</p>
                    </div>
                  </div>
                  {!isApiKeyRequired && (
                    <button
                      onClick={() => setIsSettingsOpen(false)}
                      className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                <div className="p-6 overflow-y-auto space-y-8 flex-1">

                  {/* API Key Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                      <KeyRound size={18} className="text-amber-500" />
                      <h3>Google Gemini API Key</h3>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
                      <p>
                        Để sử dụng ứng dụng, bạn cần cung cấp API Key của Google Gemini.
                        Key của bạn được <strong>lưu trữ cục bộ trên trình duyệt</strong> và không lưu trên máy chủ của chúng tôi.
                      </p>
                      <p className="font-semibold mt-2">
                        👉 Lấy API key miễn phí tại: <br />
                        <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1 mt-1">
                          aistudio.google.com/api-keys <ChevronRight size={14} />
                        </a>
                      </p>
                    </div>

                    <div>
                      <input
                        type="password"
                        placeholder="Nhập API Key bắt đầu bằng AIzaSy..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                      />
                      {isApiKeyRequired && !apiKey && (
                        <p className="text-red-500 text-xs mt-2 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> Bắt buộc phải có API Key để tiếp tục
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                      <BookOpen size={18} className="text-indigo-500" />
                      <h3>Lựa chọn Model AI</h3>
                    </div>

                    <p className="text-xs text-slate-500 mb-3">Hệ thống sẽ thử lại tự động với Model thay thế nếu có sự cố (VD: Lỗi Quota).</p>

                    <div className="grid gap-3">
                      {AI_MODELS.map(model => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModel(model.id)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left group",
                            selectedModel === model.id
                              ? "border-indigo-500 bg-indigo-50/30"
                              : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{model.icon}</span>
                            <div>
                              <p className={cn(
                                "font-bold",
                                selectedModel === model.id ? "text-indigo-700" : "text-slate-700"
                              )}>{model.name}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{model.id}</p>
                            </div>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center transition-all",
                            selectedModel === model.id ? "bg-indigo-600 text-white" : "border-2 border-slate-300"
                          )}>
                            {selectedModel === model.id && <CheckCircle2 size={12} />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                  <button
                    onClick={() => saveSettings(apiKey, selectedModel)}
                    disabled={!apiKey || apiKey.length < 10}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Lưu cấu hình
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-200 text-center">
        <p className="text-sm text-slate-400">© 2024 Trợ lý Thiết kế Bài học AI. Công cụ hỗ trợ giáo dục thông minh.</p>
      </footer>
    </div>
  );
}

// Simple Game Component integration
function GameComponent({ questions }: { questions: QuestionItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const currentQ = questions[currentIndex];

  const handleSelect = (idxStr: string) => {
    if (showAnswer) return;
    setSelectedOpt(idxStr);
    setShowAnswer(true);
    
    if (idxStr === currentQ.correctAnswer) {
      setScore(s => s + 10);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setSelectedOpt(null);
      setShowAnswer(false);
    } else {
      setGameOver(true);
    }
  };

  if (gameOver) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-6">
        <h2 className="text-5xl font-bold text-yellow-400">🎉 Hoàn Thành! 🎉</h2>
        <p className="text-3xl">Điểm của bạn: <span className="font-bold text-white text-5xl">{score}</span></p>
        <button 
          onClick={() => {
            setCurrentIndex(0);
            setScore(0);
            setGameOver(false);
            setSelectedOpt(null);
            setShowAnswer(false);
          }}
          className="px-8 py-3 bg-white text-indigo-900 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
        >
          Chơi lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex justify-between items-center mb-8">
        <div className="bg-white/20 px-4 py-2 rounded-full font-bold text-sm tracking-widest backdrop-blur-sm">
          CÂU {currentIndex + 1} / {questions.length}
        </div>
        <div className="bg-yellow-400/20 text-yellow-300 px-4 py-2 rounded-full font-bold text-sm tracking-widest backdrop-blur-sm">
          ⭐ ĐIỂM: {score}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <h3 className="text-2xl font-bold text-center leading-relaxed mb-8">
          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{currentQ.content}</Markdown>
        </h3>

        {currentQ.options && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
            {currentQ.options.map((opt, idx) => {
              const letter = ['A', 'B', 'C', 'D'][idx];
              let btnClass = "bg-white/10 hover:bg-white/20 border-white/20";
              
              if (showAnswer) {
                if (letter === currentQ.correctAnswer) {
                  btnClass = "bg-emerald-500 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] z-10 scale-105";
                } else if (letter === selectedOpt) {
                  btnClass = "bg-red-500 border-red-400 opacity-80";
                } else {
                  btnClass = "bg-white/5 border-transparent opacity-50";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(letter)}
                  className={cn(
                    "p-6 rounded-2xl border-2 text-left transition-all duration-300 backdrop-blur-sm",
                    btnClass
                  )}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center font-bold text-lg shrink-0 text-white">
                      {letter}
                    </span>
                    <span className="text-lg font-medium text-white">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</Markdown>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-20 flex items-center justify-end mt-8">
        {showAnswer && (
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-white text-indigo-900 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-50 shadow-xl"
          >
            {currentIndex < questions.length - 1 ? "Câu tiếp theo" : "Xem kết quả"} <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

function StageIndicator({ currentStage }: { currentStage: AppStage }) {
  const m2Stages: { id: AppStage; label: string }[] = [
    { id: 'm2_analyze', label: 'Phân tích' },
    { id: 'm2_needs', label: 'Nhu cầu' },
    { id: 'm2_questions', label: 'Câu hỏi' },
    { id: 'm2_game', label: 'Chơi' },
  ];
  const m1Stages: { id: AppStage; label: string }[] = [
    { id: 'm1_type', label: 'Dạng' },
    { id: 'm1_input', label: 'Nhập' },
    { id: 'm1_edit', label: 'Kiểm tra' },
    { id: 'm1_game', label: 'Chơi' },
  ];
  const isM1 = currentStage.startsWith('m1');
  const isM2 = currentStage.startsWith('m2');
  if (!isM1 && !isM2) return null;

  const stages = isM1 ? m1Stages : m2Stages;
  const curIdx = stages.findIndex(s => s.id === currentStage);

  return (
    <div className="flex items-center gap-2">
      {stages.map((s, idx) => {
        const isCompleted = idx < curIdx;
        const isCurrent = idx === curIdx;
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                isCompleted ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-200 text-slate-500'
              )}>
                {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
              </div>
              <span className="hidden md:block text-[10px] text-slate-400 whitespace-nowrap">{s.label}</span>
            </div>
            {idx < stages.length - 1 && <div className={cn('w-8 h-0.5', isCompleted ? 'bg-emerald-400' : 'bg-slate-200')} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
