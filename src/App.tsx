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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Game Links DB
const GAME_LINKS = [
  {
    id: '1',
    name: 'Bức tranh bí ẩn',
    types: ['Trắc nghiệm khách quan'],
    url: 'https://gemini.google.com/share/660e3334a4f5',
    description: 'Trò chơi lật mở từng mảnh ghép bức tranh.',
  },
  {
    id: '2',
    name: 'Mật mã thám hiểm',
    types: ['Trắc nghiệm khách quan'],
    url: 'https://gemini.google.com/share/91b856e24dd5',
    description: 'Giải mã câu hỏi để tìm đường ra.',
  },
  {
    id: '3',
    name: 'Vua tiếng Việt',
    types: ['Trả lời ngắn'],
    url: 'https://gemini.google.com/share/694fd9555ec9',
    description: 'Thử tài ngôn ngữ với các câu hỏi ngắn.',
  },
  {
    id: '4',
    name: 'Vượt ải tri thức',
    types: ['Đúng / Sai', 'Trắc nghiệm khách quan'],
    url: 'https://gemini.google.com/share/471c4821fa15',
    description: 'Vượt qua các chướng ngại vật bằng cách trả lời đúng.',
  }
];

// Types
type Stage = 1 | 2 | 3 | 4 | 5;

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
  const [stage, setStage] = useState<Stage>(1);
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

  // Stage 3, 4, 5 State
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
      setStage(2);
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
          "options": ["A", "B", "C", "D"], // (Bỏ qua nếu là tự luận/trả lời ngắn)
          "correctAnswer": "A", 
          "type": "Trắc nghiệm khách quan",
          "level": "Nhận biết"
        }
      ]

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
      setStage(3);
      
      // Parse JSON from fullText
      const jsonMatch = fullText.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (Array.isArray(parsed)) {
            setParsedQuestions(parsed);
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

  const reset = () => {
    setStage(1);
    setInputText('');
    setSelectedImage(null);
    setAnalysis(null);
    setQuestions(null);
    setParsedQuestions([]);
    setActivities(null);
    setError(null);
    setSelectedGameId(null);
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <BookOpen size={24} />
            </div>
            <h1 className="font-bold text-xl tracking-tight gradient-text">Trợ lý Thiết kế Bài học AI</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-4">
              <StageIndicator currentStage={stage} error={!!error} />
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-all"
            >
              <Settings size={18} className="text-slate-600" />
              <div className="text-left hidden sm:block">
                <div className="text-sm font-bold text-slate-700 leading-tight">Cài đặt API</div>
                <div className="text-[10px] font-semibold text-red-500 leading-tight">Lấy API key để sử dụng app</div>
              </div>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {/* Stage 1: Analysis */}
          {stage === 1 && (
            <motion.div
              key="stage1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center max-w-2xl mx-auto space-y-4">
                <h2 className="text-3xl font-bold text-slate-900">🚀 Bắt đầu hành trình thiết kế</h2>
                <p className="text-slate-500">Chào bạn! Hãy gửi cho mình nội dung bài học (văn bản hoặc hình ảnh) để mình giúp bạn phân tích nhé.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Text Input */}
                <div className="glass-card p-6 rounded-3xl">
                  <div className="flex items-center gap-2 mb-4 text-indigo-600">
                    <FileText size={20} />
                    <span className="font-semibold">Nội dung bài học</span>
                  </div>
                  <textarea
                    className="w-full h-64 p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none text-sm"
                    placeholder="Dán nội dung bài học tại đây..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </div>

                {/* Image Upload */}
                <div
                  className={cn(
                    "glass-card p-6 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4",
                    selectedImage ? "border-indigo-500 bg-indigo-50/30" : "border-indigo-200/50 hover:border-indigo-400 hover:bg-indigo-50/20"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  {selectedImage ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img src={selectedImage} alt="Preview" className="max-h-64 rounded-lg shadow-sm" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:text-red-500"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <ImageIcon size={24} />
                      </div>
                      <div className="text-center">
                        <p className="font-medium">Tải lên hình ảnh</p>
                        <p className="text-xs text-slate-400 mt-1">Hỗ trợ JPG, PNG, WEBP</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <button
                  onClick={runAnalysis}
                  disabled={isLoading || (!inputText && !selectedImage)}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight size={20} />}
                  Phân tích bài học
                </button>
              </div>
            </motion.div>
          )}

          {/* Stage 2: Clarification */}
          {stage === 2 && (
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
                    onClick={() => setStage(1)}
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

          {/* Stage 3 & 4: Results */}
          {stage === 3 && (
            <motion.div
              key="stage3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">🤖 Kết quả đồng hành cùng bạn</h2>
                  <p className="text-slate-500">Mọi thứ đã sẵn sàng! Bạn có thể xem và chỉnh sửa nhé.</p>
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

                          {q.options && (
                            <div className="flex items-center gap-2 text-sm mt-3 pt-3 border-t border-slate-100">
                              <span className="font-semibold text-emerald-600">Đáp án đúng:</span>
                              <select 
                                value={q.correctAnswer}
                                onChange={(e) => handleQuestionChange(q.id, 'correctAnswer', e.target.value)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-emerald-50 text-emerald-700 outline-none"
                              >
                                {q.options.map((opt, oIdx) => (
                                  <option key={oIdx} value={['A', 'B', 'C', 'D'][oIdx]}>
                                    {['A', 'B', 'C', 'D'][oIdx]}
                                  </option>
                                ))}
                              </select>
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
                           setStage(5);
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

          {/* Stage 5: Mini-Game */}
          {stage === 5 && (
            <motion.div
              key="stage5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              {!selectedGameId ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-bold flex items-center gap-3">
                        <Gamepad2 className="text-violet-600" size={32} />
                        Chọn Trò Chơi
                      </h2>
                      <p className="text-slate-500 mt-2">Hãy chọn một trò chơi để tích hợp với câu hỏi bạn vừa tạo.</p>
                    </div>
                    <button
                      onClick={() => setStage(3)}
                      className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                      <ChevronRight size={16} className="rotate-180" /> Quay lại chỉnh sửa
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div 
                      onClick={() => setSelectedGameId('default')}
                      className="glass-card p-6 rounded-3xl cursor-pointer hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-100 transition-all group"
                    >
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Gamepad2 size={24} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Quiz Mở Thẻ</h3>
                      <p className="text-sm text-slate-500">Mặc định. Trả lời đúng để mở thẻ, phù hợp trắc nghiệm.</p>
                    </div>

                    <div 
                      onClick={() => setSelectedGameId('vuot_ai')}
                      className="glass-card p-6 rounded-3xl cursor-pointer hover:border-sky-500 hover:shadow-lg hover:shadow-sky-100 transition-all group"
                    >
                      <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={24} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Vượt Ải Tri Thức</h3>
                      <p className="text-sm text-slate-500">Giao diện bóng tối. Trả lời đúng/sai hoặc trắc nghiệm tốc độ vòng 1.</p>
                    </div>

                    <div 
                      onClick={() => setSelectedGameId('vua_tieng_viet')}
                      className="glass-card p-6 rounded-3xl cursor-pointer hover:border-pink-500 hover:shadow-lg hover:shadow-pink-100 transition-all group"
                    >
                      <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <BookOpen size={24} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Vua Tiếng Việt</h3>
                      <p className="text-sm text-slate-500">Thử thách từ vựng. Trả lời ngắn, sắp xếp chữ cái trong thời gian giới hạn.</p>
                    </div>
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
                        // Extract correct answer logic
                        let answer = q.correctAnswer || (q.options ? q.options[0] : 'ĐÁP ÁN');
                        if (['A', 'B', 'C', 'D'].includes(answer) && q.options) {
                           const idx = ['A', 'B', 'C', 'D'].indexOf(answer);
                           if (idx >= 0 && q.options[idx]) {
                             answer = q.options[idx];
                           }
                        }
                        return {
                          text: q.content,
                          answer: answer,
                          scrambled: answer.split('').sort(() => Math.random() - 0.5).join('').toUpperCase(),
                          image: null
                        };
                      })} 
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
                    <span className="text-lg font-medium text-white">{opt}</span>
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

function StageIndicator({ currentStage, error }: { currentStage: Stage, error: boolean }) {
  const stages = [
    { id: 1, label: 'Bước 1: Phân tích' },
    { id: 2, label: 'Bước 2: Nhu cầu' },
    { id: 3, label: 'Bước 3 & 4: Kết quả' }
  ];

  return (
    <div className="flex items-center gap-2">
      {stages.map((s, idx) => {
        const isCurrent = currentStage === s.id;
        const isCompleted = currentStage > s.id;

        let bgColor = "bg-slate-200 text-slate-500";
        let labelColor = "text-slate-400";
        let labelText = s.label;

        if (isCompleted) {
          bgColor = "bg-emerald-500 text-white";
          labelColor = "text-emerald-600 font-bold";
        } else if (isCurrent) {
          if (error) {
            bgColor = "bg-red-500 text-white";
            labelColor = "text-red-500 font-bold";
            labelText = "Đã dừng do lỗi";
          } else {
            bgColor = "bg-indigo-600 text-white ring-4 ring-indigo-100";
            labelColor = "text-indigo-600 font-bold";
          }
        }

        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1 relative group">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 z-10",
                  bgColor
                )}
              >
                {isCompleted ? <CheckCircle2 size={16} /> : (isCurrent && error ? <AlertCircle size={16} /> : s.id)}
              </div>
              <span className={cn(
                "hidden md:block absolute top-10 whitespace-nowrap text-[11px] px-2 py-1 rounded bg-white/80 backdrop-blur shadow-sm border border-slate-100",
                labelColor
              )}>
                {labelText}
              </span>
            </div>
            {idx < stages.length - 1 && (
              <div className={cn(
                "w-12 h-1 transition-all duration-300",
                isCompleted ? "bg-emerald-500" : "bg-slate-200"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
