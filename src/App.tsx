/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, FormEvent } from "react";
import { 
  ClipboardCheck, 
  Send, 
  User, 
  Calendar, 
  Activity, 
  FileText, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Dog,
  Settings,
  Key,
  Eye,
  EyeOff,
  Database,
  Cloud
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Inko from "inko/index.js";
import { HangulInput, HangulTextarea } from "./components/HangulInput";
import { 
  saveLogToFirestore, 
  batchSaveLogsToFirestore, 
  subscribeToCareLogs, 
  SavedLogItem,
  saveBatchClientsToCloud,
  loadBatchClientsFromCloud
} from "./lib/firebase";
import { CloudLogsModal } from "./components/CloudLogsModal";

import carelogClLogo from "./assets/images/carelog_cl_separated_1779430172627.png";

type LogType = "생활일지" | "프로그램일지";

interface BatchClient {
  name: string;
  transit?: string;
  hygiene?: string;
  diet?: string;
  health?: string;
  program?: string;
  others?: string;
  programName?: string;
  observation?: string;
  support?: string;
  reaction?: string;
  plan?: string;
}

export default function App() {
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem("carelog_admin_api_key") || "");
  const [geminiModel, setGeminiModel] = useState(() => localStorage.getItem("carelog_gemini_model") || "gemini-3.1-flash-lite");
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedCloudLogs, setSavedCloudLogs] = useState<SavedLogItem[]>([]);
  const [showCloudModal, setShowCloudModal] = useState(false);

  const [activeEditIndex, setActiveEditIndex] = useState(0);
  const [isBatchMode, setIsBatchMode] = useState(() => localStorage.getItem("carelog_is_batch_mode") === "true");
  const [batchClients, setBatchClients] = useState<BatchClient[]>(() => {
    try {
      const saved = localStorage.getItem("carelog_batch_clients");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => ({
            name: c.name || "",
            transit: c.transit || "",
            hygiene: c.hygiene || "",
            diet: c.diet || "",
            health: c.health !== undefined ? c.health : "양호함 / 체온: 정상",
            program: c.program || "",
            others: c.others || "",
            programName: c.programName || "",
            observation: c.observation || "",
            support: c.support || "",
            reaction: c.reaction || "",
            plan: c.plan || ""
          }));
        }
      }
    } catch (e) {}
    return Array.from({ length: 6 }, () => ({
      name: "",
      transit: "",
      hygiene: "",
      diet: "",
      health: "양호함 / 체온: 정상",
      program: "",
      others: "",
      programName: "",
      observation: "",
      support: "",
      reaction: "",
      plan: ""
    }));
  });
  const [selectedBatchTab, setSelectedBatchTab] = useState(0);
  const [copyAllSuccess, setCopyAllSuccess] = useState(false);

  const [name, setName] = useState(() => localStorage.getItem("w_name") || "");
  const [date, setDate] = useState(() => {
    const isManuallyChanged = localStorage.getItem("w_date_manually_changed") === "true";
    const today = new Date().toISOString().split('T')[0];
    if (isManuallyChanged) {
      return localStorage.getItem("w_date") || today;
    }
    return today;
  });
  const [type, setType] = useState<LogType>(() => (localStorage.getItem("w_type") as LogType) || "생활일지");
  
  // 생활일지 관련 state
  const [transit, setTransit] = useState(() => localStorage.getItem("w_transit") || "");
  const [hygiene, setHygiene] = useState(() => localStorage.getItem("w_hygiene") || "");
  const [diet, setDiet] = useState(() => localStorage.getItem("w_diet") || "");
  const [health, setHealth] = useState(() => localStorage.getItem("w_health") || "");
  const [program, setProgram] = useState(() => localStorage.getItem("w_program") || "");
  const [others, setOthers] = useState(() => localStorage.getItem("w_others") || "");

  // 프로그램일지 관련 state
  const [programName, setProgramName] = useState(() => localStorage.getItem("w_programName") || "");
  const [observation, setObservation] = useState(() => localStorage.getItem("w_observation") || "");
  const [support, setSupport] = useState(() => localStorage.getItem("w_support") || "");
  const [reaction, setReaction] = useState(() => localStorage.getItem("w_reaction") || "");
  const [plan, setPlan] = useState(() => localStorage.getItem("w_plan") || "");

  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const parseBatchResult = (rawText: string) => {
    if (!rawText) return [];
    const parts = rawText.split(/\[START:(.+?)\]/g);
    const parsed: { name: string; content: string }[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const personName = parts[i]?.trim();
      let content = parts[i + 1] || "";
      const endTag = `[END:${personName}]`;
      if (content.includes(endTag)) {
        content = content.split(endTag)[0];
      }
      if (content.includes("[END]")) {
        content = content.split("[END]")[0];
      }
      parsed.push({ name: personName, content: content.trim() });
    }
    return parsed;
  };

  const getFilledCount = (client: BatchClient, logType: LogType) => {
    let count = 0;
    if (logType === "생활일지") {
      if (client.transit?.trim()) count++;
      if (client.hygiene?.trim()) count++;
      if (client.diet?.trim()) count++;
      if (client.health?.trim()) count++;
      if (client.program?.trim()) count++;
      if (client.others?.trim()) count++;
    } else {
      if (client.programName?.trim()) count++;
      if (client.observation?.trim()) count++;
      if (client.support?.trim()) count++;
      if (client.reaction?.trim()) count++;
      if (client.plan?.trim()) count++;
    }
    return count;
  };

  // Subscribe to Firebase real-time care logs and initialize cloud data
  useEffect(() => {
    const unsubscribe = subscribeToCareLogs((logs) => {
      setSavedCloudLogs(logs);
    });

    // Try loading cloud batch clients if localStorage is default
    loadBatchClientsFromCloud().then((cloudClients) => {
      if (cloudClients && Array.isArray(cloudClients) && cloudClients.length > 0) {
        const localSaved = localStorage.getItem("carelog_batch_clients");
        if (!localSaved) {
          setBatchClients(cloudClients);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Sync state to localStorage to handle and survive F5 manual/triggered refresh
  useEffect(() => {
    localStorage.setItem("w_name", name);
    localStorage.setItem("w_date", date);
    localStorage.setItem("w_type", type);
    localStorage.setItem("w_transit", transit);
    localStorage.setItem("w_hygiene", hygiene);
    localStorage.setItem("w_diet", diet);
    localStorage.setItem("w_health", health);
    localStorage.setItem("w_program", program);
    localStorage.setItem("w_others", others);
    localStorage.setItem("w_programName", programName);
    localStorage.setItem("w_observation", observation);
    localStorage.setItem("w_support", support);
    localStorage.setItem("w_reaction", reaction);
    localStorage.setItem("w_plan", plan);
    localStorage.setItem("carelog_is_batch_mode", String(isBatchMode));
    localStorage.setItem("carelog_batch_clients", JSON.stringify(batchClients));
  }, [name, date, type, transit, hygiene, diet, health, program, others, programName, observation, support, reaction, plan, isBatchMode, batchClients]);

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
    }
    setIsLoading(false);
    setProgress(0);
  };

  const generateLog = async () => {
    setIsLoading(true);
    setError("");
    setResult("");
    setProgress(0);
    setSelectedBatchTab(0);

    const controller = new AbortController();
    setAbortController(controller);

    // Progress bar runner simulation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) {
          clearInterval(progressInterval);
          return 98;
        }
        // Start faster, slow down as it approaches 100%
        const step = prev < 30 ? 6 : prev < 60 ? 3 : prev < 85 ? 1.5 : prev < 95 ? 0.5 : 0.1;
        return Math.min(prev + step, 98);
      });
    }, 100);

    const data = type === "생활일지" 
      ? { transit, hygiene, diet, health, program, others }
      : { programName, observation, support, reaction, plan };

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 45000); // 45 seconds safety timeout

    try {
      const activeClients = batchClients.filter(c => c.name.trim() !== "");
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(customApiKey.trim() ? { "x-api-key": customApiKey.trim() } : {})
        },
        body: JSON.stringify({
          type,
          name: isBatchMode ? "" : name,
          date,
          data,
          apiKey: customApiKey.trim(),
          model: geminiModel,
          ...(isBatchMode ? { names: activeClients } : {})
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      clearInterval(progressInterval);

      if (controller.signal.aborted) {
        throw new Error("요청이 취소되었습니다.");
      }

      const resData = await response.json();
      if (resData.error) throw new Error(resData.error);
      
      setProgress(100);
      
      // Delay slightly to let user see 100% progress completes
      setTimeout(async () => {
        setResult(resData.result);
        setIsLoading(false);

        // Auto-save generated log to Firebase Firestore
        try {
          if (isBatchMode) {
            const parsed = parseBatchResult(resData.result);
            if (parsed.length > 0) {
              await batchSaveLogsToFirestore(
                parsed.map((p) => ({
                  clientName: p.name,
                  date,
                  type,
                  content: p.content,
                }))
              );
            }
            // Auto sync batch clients preset to cloud
            saveBatchClientsToCloud(batchClients);
          } else {
            if (name && resData.result) {
              await saveLogToFirestore({
                clientName: name,
                date,
                type,
                content: resData.result,
              });
            }
          }
        } catch (cloudErr) {
          console.error("Firebase auto-save error:", cloudErr);
        }
      }, 350);
    } catch (err: any) {
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      if (err.name === 'AbortError' || err.message === "요청이 취소되었습니다.") {
        setError("기록 생성이 취소되었습니다. 입력 내용을 수정하여 다시 시도할 수 있습니다.");
      } else {
        setError(err.message || "오류가 발생했습니다. 다시 시도해주세요.");
      }
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isBatchMode) {
      const activeClients = batchClients.filter(c => c.name.trim() !== "");
      if (activeClients.length === 0) {
        setError("최소 한 명 이상의 이용인 성함을 입력해야 합니다.");
        return;
      }
      if (type === "프로그램일지") {
        for (const client of activeClients) {
          if (!client.programName?.trim() || !client.observation?.trim()) {
            setError(`${client.name} 이용인의 프로그램명과 관찰내용은 필수 입력 항목입니다.`);
            return;
          }
        }
      }
    } else {
      if (!name) {
        setError("이용인 성함은 필수 입력 항목입니다.");
        return;
      }
      if (type === "프로그램일지" && (!programName.trim() || !observation.trim())) {
        setError("프로그램명과 관찰내용은 필수입니다.");
        return;
      }
    }

    await generateLog();
  };

  const handleRetry = async () => {
    if (abortController) {
      abortController.abort();
    }
    await generateLog();
  };

  const handleCopy = () => {
    if (!result) return;
    const parsed = parseBatchResult(result);
    if (isBatchMode && parsed.length > 0) {
      const activeLog = parsed[selectedBatchTab];
      if (activeLog) {
        navigator.clipboard.writeText(activeLog.content);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } else {
      navigator.clipboard.writeText(result);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCopyAll = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopyAllSuccess(true);
    setTimeout(() => setCopyAllSuccess(false), 2000);
  };

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    localStorage.setItem("carelog_admin_api_key", key);
  };

  const handleReset = () => {
    setName("");
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    localStorage.removeItem("w_date_manually_changed");
    setTransit("");
    setHygiene("");
    setDiet("");
    setHealth("");
    setProgram("");
    setOthers("");
    setProgramName("");
    setObservation("");
    setSupport("");
    setReaction("");
    setPlan("");
    setResult("");
    setError("");
    setBatchClients(Array.from({ length: 6 }, () => ({
      name: "",
      transit: "",
      hygiene: "",
      diet: "",
      health: "양호함 / 체온: 정상",
      program: "",
      others: "",
      programName: "",
      observation: "",
      support: "",
      reaction: "",
      plan: ""
    })));
    setActiveEditIndex(0);
  };

  const parsedLogs = isBatchMode ? parseBatchResult(result) : [];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between text-center sm:text-left gap-4">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
              <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0 bg-white rounded-xl shadow-md transition-all duration-300 select-none hover:scale-105 overflow-hidden">
                <img
                  src={carelogClLogo}
                  alt="CareLog Logo"
                  className="w-full h-full object-cover scale-[1.02]"
                  style={{ imageRendering: "-webkit-optimize-contrast" }}
                  referrerPolicy="no-referrer"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                CareLog
              </h1>
            </div>
            <p className="text-gray-500 text-sm">
              간단한 메모를 전문적인 복지 기록으로 변환해 드립니다.
            </p>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowCloudModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-blue-50/70 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 hover:border-blue-300 shadow-xs transition-all duration-200 active:scale-95 whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>클라우드 보관함</span>
              {savedCloudLogs.length > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full">
                  {savedCloudLogs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 hover:border-gray-300 shadow-sm transition-all duration-200 active:scale-95 whitespace-nowrap"
            >
              <Settings className="w-4 h-4 text-gray-500 animate-[spin_20s_infinite_linear]" />
              API 키 및 모델 설정
              {customApiKey ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-100" />
              )}
            </button>
          </div>
        </header>

        {/* API Key Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden bg-white rounded-2xl border border-gray-105 shadow-sm"
            >
              <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-800">
                  <Key className="w-4.5 h-4.5 text-gray-500" />
                  <h3 className="font-bold text-sm">기록 생성 제한 대비 - API 키 및 Gemini 모델 설정</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  닫기
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  CareLog는 모든 사용자에게 기본적인 Gemini 무료 생성(기본 임시 키)을 지원하지만, 사용량이 급증할 때 <strong>무료 트래픽 초과(429)</strong>가 발생할 수 있습니다. <br />
                  이 경우, 본인이 발급받은 개인/기관용 <strong>Google Gemini API Key</strong>를 입력해 두시면 한도 제한 없이 최고 속도로 무제한 생성하실 수 있습니다. (설정값은 사용자의 웹브라우저에만 암호화 및 안전하게 보존됩니다)
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 flex items-center justify-between">
                    <span>Gemini API Key</span>
                    <a
                      href="https://aistudio.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                    >
                      무료 API Key 발급받기 →
                    </a>
                  </label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showApiKey ? "text" : "password"}
                        placeholder="AI Studio에서 발급받은 API Key (AIzaSy-- 로 시작)"
                        value={customApiKey}
                        onChange={(e) => handleSaveApiKey(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400 text-gray-700 font-mono"
                      />
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title={showApiKey ? "비밀번호 숨기기" : "비밀번호 표시"}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {customApiKey && (
                      <button
                        type="button"
                        onClick={() => handleSaveApiKey("")}
                        className="px-4 py-2.5 text-xs border border-red-200 text-red-500 bg-red-50/50 hover:bg-red-50 hover:text-red-600 rounded-xl font-bold transition-all active:scale-95"
                      >
                        초기화
                      </button>
                    )}
                  </div>
                </div>

                {/* Gemini Model Version Selection */}
                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-gray-500" />
                    <span>Gemini 모델 버전 선택</span>
                  </label>
                  <div className="relative">
                    <select
                      value={geminiModel}
                      onChange={(e) => {
                        const m = e.target.value;
                        setGeminiModel(m);
                        localStorage.setItem("carelog_gemini_model", m);
                      }}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400 text-gray-700 cursor-pointer appearance-none"
                    >
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (추천 - 초고속 경량 기본 모델)</option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (최신 모델 - 최상 성능 및 고효율)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (가장 향상된 문맥 이해 및 최신 속도)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (안정적인 구조화된 답변 능력)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (복잡한 지시사항 및 높은 정확도)</option>
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-normal">
                    * 무료 Key는 각 모델마다 속도/요청 제한이 다르게 적용될 수 있습니다. 429 에러가 발생하면 Lite 또는 Flash 버전을 권장합니다.
                  </p>
                </div>

                <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5 animate-pulse" />
                  <p className="font-medium leading-relaxed">
                    {customApiKey 
                      ? "사용자 입력 API Key가 적용 중입니다. 모든 생성 요청이 개인 API Key를 사용하여 한도 없이 작동합니다." 
                      : "현재 임시 통합 무료 키가 사용되고 있습니다. 하루 무료 생성 횟수 도달 시 429 오류가 발생할 수 있습니다."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Input Section */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> 입력 정보
                </h2>
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="전체 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* 기록 모드 선택 토글 */}
              <div className="flex bg-gray-100/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsBatchMode(false)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${!isBatchMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                >
                  개별 기록 (1인)
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchMode(true)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${isBatchMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                >
                  반 전체 일괄 기록 (6인 동시)
                </button>
              </div>

              {isBatchMode ? (
                <>
                  {/* Common Selection Grid for Date and LogType */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                        <Calendar className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 날짜
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          localStorage.setItem("w_date_manually_changed", "true");
                        }}
                        className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                        <FileText className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 기록 유형
                      </label>
                      <div className="relative">
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as LogType)}
                          className={`w-full appearance-none px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all cursor-pointer pr-10`}
                        >
                          <option value="생활일지">생활일지</option>
                          <option value="프로그램일지">프로그램일지</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Cohesive Batch Mode Workspace */}
                  <div className="space-y-4 p-4 sm:p-5 bg-gray-50/50 rounded-2xl border border-gray-200/60 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <User className={`w-4 h-4 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"}`} />
                        이용인 등록 및 개별 내용 입력 (최대 6명)
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">이름이 입력된 대상만 일지가 생성됩니다.</span>
                    </div>

                    {/* Quick Selection Slider Grid with Progress */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-gray-200/40 p-2 rounded-xl">
                      {batchClients.map((client, idx) => {
                        const filled = getFilledCount(client, type);
                        const total = type === "생활일지" ? 6 : 5;
                        const isNameEntered = client.name.trim().length > 0;
                        const isSelected = activeEditIndex === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveEditIndex(idx)}
                            className={`py-2 px-1 text-xs font-bold rounded-lg transition-all border flex flex-col items-center justify-center relative ${
                              isSelected
                                ? type === "생활일지"
                                  ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                                  : "bg-purple-600 border-purple-600 text-white shadow-xs"
                                : isNameEntered
                                  ? "bg-white border-gray-200 text-gray-800 hover:bg-gray-100"
                                  : "bg-gray-100/30 border-dashed border-gray-200 text-gray-400 hover:bg-gray-50"
                            }`}
                          >
                            <span className="text-[9px] opacity-75">#{idx + 1}</span>
                            <span className="truncate max-w-full text-[11px] leading-tight mt-0.5 font-extrabold">
                              {client.name.trim() || "미등록"}
                            </span>
                            {isNameEntered && (
                              <span className={`text-[8px] px-1 mt-1 rounded-full ${
                                isSelected 
                                  ? "bg-white/20 text-white" 
                                  : filled === total
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-gray-100 text-gray-600"
                              }`}>
                                {filled}/{total}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Client's Dynamic Form Workspace Panel */}
                    <div className={`p-4 bg-white rounded-xl border-2 transition-all ${
                      type === "생활일지" ? "border-blue-100" : "border-purple-100"
                    }`}>
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            batchClients[activeEditIndex]?.name.trim() ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
                          }`} />
                          <span className="text-xs font-bold text-gray-800">
                            이용인 #{activeEditIndex + 1} 님 개별 상세 기록
                          </span>
                        </div>
                        {batchClients[activeEditIndex]?.name && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...batchClients];
                              updated[activeEditIndex] = {
                                name: "",
                                transit: "",
                                hygiene: "",
                                diet: "",
                                health: "양호함 / 체온: 정상",
                                program: "",
                                others: "",
                                programName: "",
                                observation: "",
                                support: "",
                                reaction: "",
                                plan: ""
                              };
                              setBatchClients(updated);
                            }}
                            className="text-[9px] text-red-500 hover:underline font-bold"
                          >
                            이 이용인 데이터 초기화
                          </button>
                        )}
                      </div>

                      {/* Name Row */}
                      <div className="space-y-1 mb-3">
                        <span className="text-[10px] font-bold text-gray-500">성함</span>
                        <HangulInput
                          type="text"
                          lang="ko"
                          placeholder="성함 (예: 김철수)"
                          value={batchClients[activeEditIndex]?.name || ""}
                          onChange={(e: any) => {
                            const updated = [...batchClients];
                            updated[activeEditIndex].name = e.target.value;
                            setBatchClients(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400 font-bold"
                        />
                      </div>

                      {!batchClients[activeEditIndex]?.name.trim() && (
                        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 text-[11px] text-amber-700 font-semibold mb-3 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>성함을 입력해야 개별 인공지능(AI) 일지가 생성됩니다.</span>
                        </div>
                      )}

                      {/* Detailed Inputs per Active Client */}
                      <div className="pt-3 border-t border-gray-150 space-y-3">
                        {type === "생활일지" ? (
                          <>
                            {/* 입퇴소 및 송영 */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-blue-600">입퇴소 및 송영</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = batchClients[activeEditIndex]?.transit || "";
                                    const updated = batchClients.map(c => ({ ...c, transit: val }));
                                    setBatchClients(updated);
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 font-bold"
                                  title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  일괄 적용
                                </button>
                              </div>
                              <HangulInput
                                type="text"
                                lang="ko"
                                placeholder="예: 송영차량 이용, 보호자 직접 등원"
                                value={batchClients[activeEditIndex]?.transit || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].transit = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>

                            {/* 위생 및 청결 */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-blue-600">위생 및 청결</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = batchClients[activeEditIndex]?.hygiene || "";
                                    const updated = batchClients.map(c => ({ ...c, hygiene: val }));
                                    setBatchClients(updated);
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 font-bold"
                                  title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  일괄 적용
                                </button>
                              </div>
                              <HangulInput
                                type="text"
                                lang="ko"
                                placeholder="예: 스스로 손씻기 수행, 세수 지원"
                                value={batchClients[activeEditIndex]?.hygiene || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].hygiene = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>

                            {/* 식생활 */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-blue-600">식생활</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = batchClients[activeEditIndex]?.diet || "";
                                    const updated = batchClients.map(c => ({ ...c, diet: val }));
                                    setBatchClients(updated);
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 font-bold"
                                  title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  일괄 적용
                                </button>
                              </div>
                              <HangulInput
                                type="text"
                                lang="ko"
                                placeholder="예: 전량 섭취, 생선 위주로 식사"
                                value={batchClients[activeEditIndex]?.diet || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].diet = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>

                            {/* 건강관리 & 프로그램 Grid */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-blue-600">건강관리</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = batchClients[activeEditIndex]?.health || "";
                                      const updated = batchClients.map(c => ({ ...c, health: val }));
                                      setBatchClients(updated);
                                    }}
                                    className="text-[9px] text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 font-bold"
                                    title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    일괄 적용
                                  </button>
                                </div>
                                <HangulInput
                                  type="text"
                                  lang="ko"
                                  placeholder="예: 양호함 / 체온: 정상"
                                  value={batchClients[activeEditIndex]?.health || ""}
                                  onChange={(e: any) => {
                                    const updated = [...batchClients];
                                    updated[activeEditIndex].health = e.target.value;
                                    setBatchClients(updated);
                                  }}
                                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-blue-600">프로그램</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = batchClients[activeEditIndex]?.program || "";
                                      const updated = batchClients.map(c => ({ ...c, program: val }));
                                      setBatchClients(updated);
                                    }}
                                    className="text-[9px] text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 font-bold"
                                    title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    일괄 적용
                                  </button>
                                </div>
                                <HangulInput
                                  type="text"
                                  lang="ko"
                                  placeholder="예: 동화구연"
                                  value={batchClients[activeEditIndex]?.program || ""}
                                  onChange={(e: any) => {
                                    const updated = [...batchClients];
                                    updated[activeEditIndex].program = e.target.value;
                                    setBatchClients(updated);
                                  }}
                                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400"
                                />
                              </div>
                            </div>

                            {/* 기타사항 */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-blue-600">기타사항</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = batchClients[activeEditIndex]?.others || "";
                                    const updated = batchClients.map(c => ({ ...c, others: val }));
                                    setBatchClients(updated);
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 font-bold"
                                  title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  일괄 적용
                                </button>
                              </div>
                              <HangulInput
                                type="text"
                                lang="ko"
                                placeholder="기타 특이사항 기재"
                                value={batchClients[activeEditIndex]?.others || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].others = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            {/* 프로그램명 */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-purple-600">프로그램명</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = batchClients[activeEditIndex]?.programName || "";
                                    const updated = batchClients.map(c => ({ ...c, programName: val }));
                                    setBatchClients(updated);
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-0.5 font-bold"
                                  title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  일괄 적용
                                </button>
                              </div>
                              <HangulInput
                                type="text"
                                lang="ko"
                                placeholder="프로그램 제목을 입력하세요"
                                value={batchClients[activeEditIndex]?.programName || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].programName = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-400"
                              />
                            </div>

                            {/* 관찰내용 */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-purple-600">관찰내용</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = batchClients[activeEditIndex]?.observation || "";
                                    const updated = batchClients.map(c => ({ ...c, observation: val }));
                                    setBatchClients(updated);
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-0.5 font-bold"
                                  title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  일괄 적용
                                </button>
                              </div>
                              <HangulTextarea
                                rows={2}
                                lang="ko"
                                placeholder="이용인의 실제 행동 중심 관찰 내용 기재"
                                value={batchClients[activeEditIndex]?.observation || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].observation = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-400 resize-none"
                              />
                            </div>

                            {/* 지원내용 */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-purple-600">지원내용</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = batchClients[activeEditIndex]?.support || "";
                                    const updated = batchClients.map(c => ({ ...c, support: val }));
                                    setBatchClients(updated);
                                  }}
                                  className="text-[9px] text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-0.5 font-bold"
                                  title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  일괄 적용
                                </button>
                              </div>
                              <HangulInput
                                type="text"
                                lang="ko"
                                placeholder="직원의 개입이나 도움"
                                value={batchClients[activeEditIndex]?.support || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].support = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-400"
                              />
                            </div>

                            {/* 반응 및 계획 Grid */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-purple-600">의미 있는 반응</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = batchClients[activeEditIndex]?.reaction || "";
                                      const updated = batchClients.map(c => ({ ...c, reaction: val }));
                                      setBatchClients(updated);
                                    }}
                                    className="text-[9px] text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-0.5 font-bold"
                                    title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    일괄 적용
                                  </button>
                                </div>
                                <HangulInput
                                  type="text"
                                  lang="ko"
                                  placeholder="작은 변화나 반응"
                                  value={batchClients[activeEditIndex]?.reaction || ""}
                                  onChange={(e: any) => {
                                    const updated = [...batchClients];
                                    updated[activeEditIndex].reaction = e.target.value;
                                    setBatchClients(updated);
                                  }}
                                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-400"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-purple-600">차주 지원계획</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = batchClients[activeEditIndex]?.plan || "";
                                      const updated = batchClients.map(c => ({ ...c, plan: val }));
                                      setBatchClients(updated);
                                    }}
                                    className="text-[9px] text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-0.5 font-bold"
                                    title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    일괄 적용
                                  </button>
                                </div>
                                <HangulInput
                                  type="text"
                                  lang="ko"
                                  placeholder="실천 가능한 계획"
                                  value={batchClients[activeEditIndex]?.plan || ""}
                                  onChange={(e: any) => {
                                    const updated = [...batchClients];
                                    updated[activeEditIndex].plan = e.target.value;
                                    setBatchClients(updated);
                                  }}
                                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-400"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Navigation Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        disabled={activeEditIndex === 0}
                        onClick={() => setActiveEditIndex(prev => prev - 1)}
                        className={`flex items-center gap-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                          activeEditIndex === 0
                            ? "border-gray-150 text-gray-300 cursor-not-allowed bg-gray-50/50"
                            : "border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        이전 이용인
                      </button>

                      <div className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {activeEditIndex + 1} / 6 번째 이용인 입력 중
                      </div>

                      <button
                        type="button"
                        disabled={activeEditIndex === 5}
                        onClick={() => setActiveEditIndex(prev => prev + 1)}
                        className={`flex items-center gap-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                          activeEditIndex === 5
                            ? "border-gray-150 text-gray-300 cursor-not-allowed bg-gray-50/50"
                            : "border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        다음 이용인
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Tip Card */}
                    <div className="p-3 bg-blue-50/30 rounded-xl border border-blue-100/50 text-[11px] text-blue-700/90 leading-relaxed space-y-1">
                      <p className="font-bold flex items-center gap-1">💡 일괄 복사 팁 (매우 빠른 입력 방법):</p>
                      <p>
                        첫 번째 이용인에게 내용을 모두 적은 뒤, 각 항목 우측 상단의 <span className="font-extrabold text-blue-600">"일괄 적용"</span> 버튼을 누르면 다른 5명의 이용인에게 동일한 내용이 즉시 입력됩니다. 복사 후에 개별적으로 다른 내용을 가진 이용인의 항목만 수정하면 아주 편리하게 입력할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                        <User className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 이름
                      </label>
                      <HangulInput
                        type="text"
                        lang="ko"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="이용인 성함 (예: 김OO)"
                        value={name}
                        onChange={(e: any) => setName(e.target.value)}
                        className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all placeholder:text-gray-400`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                        <Calendar className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 날짜
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          localStorage.setItem("w_date_manually_changed", "true");
                        }}
                        className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                      <FileText className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 기록 유형
                    </label>
                    <div className="relative">
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as LogType)}
                        className={`w-full appearance-none px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all cursor-pointer pr-10`}
                      >
                        <option value="생활일지">생활일지</option>
                        <option value="프로그램일지">프로그램일지</option>
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {type === "생활일지" ? (
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">입퇴소 및 송영</label>
                        <HangulInput
                          type="text"
                          lang="ko"
                          placeholder="예: 송영차량 이용, 보호자 직접 등원"
                          value={transit}
                          onChange={(e: any) => setTransit(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">위생 및 청결</label>
                        <HangulInput
                          type="text"
                          lang="ko"
                          placeholder="예: 스스로 손씻기 수행, 세수 지원"
                          value={hygiene}
                          onChange={(e: any) => setHygiene(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">식생활</label>
                        <HangulInput
                          type="text"
                          lang="ko"
                          placeholder="예: 전량 섭취, 생선 위주로 식사"
                          value={diet}
                          onChange={(e: any) => setDiet(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">건강관리</label>
                          <HangulInput
                            type="text"
                            lang="ko"
                            placeholder="예: 양호함 / 체온: 정상"
                            value={health}
                            onChange={(e: any) => setHealth(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">프로그램</label>
                          <HangulInput
                            type="text"
                            lang="ko"
                            placeholder="예: 동화구연"
                            value={program}
                            onChange={(e: any) => setProgram(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">기타사항</label>
                        <HangulInput
                          type="text"
                          lang="ko"
                          placeholder="상호작용 등"
                          value={others}
                          onChange={(e: any) => setOthers(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-purple-600 uppercase tracking-wider">프로그램명</label>
                        <HangulInput
                          type="text"
                          lang="ko"
                          placeholder="프로그램 제목을 입력하세요"
                          value={programName}
                          onChange={(e: any) => setProgramName(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-purple-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-purple-600 uppercase tracking-wider">관찰내용</label>
                        <HangulTextarea
                          rows={2}
                          lang="ko"
                          placeholder="이용인의 실제 행동 중심"
                          value={observation}
                          onChange={(e: any) => setObservation(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-purple-400 resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-purple-600 uppercase tracking-wider">지원내용</label>
                        <HangulInput
                          type="text"
                          lang="ko"
                          placeholder="직원의 개입이나 도움"
                          value={support}
                          onChange={(e: any) => setSupport(e.target.value)}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-purple-400"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-purple-600 uppercase tracking-wider">의미 있는 반응</label>
                          <HangulInput
                            type="text"
                            lang="ko"
                            placeholder="작은 변화나 반응"
                            value={reaction}
                            onChange={(e: any) => setReaction(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-purple-400"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-purple-600 uppercase tracking-wider">차주 지원계획</label>
                          <HangulInput
                            type="text"
                            lang="ko"
                            placeholder="실천 가능한 계획"
                            value={plan}
                            onChange={(e: any) => setPlan(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-purple-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-500 text-xs font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                  <div className="flex items-center gap-2 flex-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (abortController) {
                        abortController.abort();
                      }
                      // Secure all inputs into localStorage to ensure everything survives F5
                      localStorage.setItem("w_name", name);
                      localStorage.setItem("w_date", date);
                      localStorage.setItem("w_type", type);
                      localStorage.setItem("w_transit", transit);
                      localStorage.setItem("w_hygiene", hygiene);
                      localStorage.setItem("w_diet", diet);
                      localStorage.setItem("w_health", health);
                      localStorage.setItem("w_program", program);
                      localStorage.setItem("w_others", others);
                      localStorage.setItem("w_programName", programName);
                      localStorage.setItem("w_observation", observation);
                      localStorage.setItem("w_support", support);
                      localStorage.setItem("w_reaction", reaction);
                      localStorage.setItem("w_plan", plan);
                      
                      // Perform F5 refresh style actual page reload!
                      window.location.reload();
                    }}
                    className="shrink-0 bg-white hover:bg-rose-100 text-red-600 px-2.5 py-1.5 text-[11px] rounded-lg border border-red-200 hover:border-red-300 font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95"
                    title="입력한 내용은 지우지 않고 페이지를 새로고침(F5)합니다."
                  >
                    입력 유지하고 새로고침
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 ${
                  type === "생활일지" 
                    ? "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300" 
                    : "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300"
                } text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    기록 생성 중...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {type} 생성하기
                  </>
                )}
              </button>
            </form>
          </motion.div>

          {/* Output Section */}
          <div className="flex flex-col h-full">
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col relative overflow-hidden min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-700">생성된 기록</h2>
                {result && (
                  <div className="flex items-center gap-1.5">
                    {isBatchMode && parsedLogs.length > 0 && (
                      <button
                        onClick={handleCopyAll}
                        className={`flex items-center gap-1 text-xs text-gray-500 hover:bg-gray-50 font-semibold px-2.5 py-1.5 rounded-full transition-colors`}
                        title="모든 이용인의 일지를 한 번에 클립보드에 복사합니다."
                      >
                        {copyAllSuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            전체 복사됨!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-gray-400" />
                            전체 복사
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-1.5 text-xs ${type === "생활일지" ? "text-blue-600 hover:bg-blue-50" : "text-purple-600 hover:bg-purple-50"} font-semibold px-3 py-1.5 rounded-full transition-colors`}
                    >
                      {copySuccess ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          복사됨!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          {isBatchMode ? "선택 이용인 복사" : "기록 복사"}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {isBatchMode && result && parsedLogs.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-gray-100">
                  {parsedLogs.map((log, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedBatchTab(idx)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg shrink-0 transition-all ${
                        selectedBatchTab === idx
                          ? type === "생활일지"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-purple-600 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {log.name}
                    </button>
                  ))}
                </div>
              )}

              <div className={`mb-3.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 ${type === "생활일지" ? "bg-blue-50/40 border border-blue-100/50" : "bg-purple-50/40 border border-purple-100/50"} px-3.5 py-2 rounded-xl transition-all`}>
                <span className="font-semibold text-gray-700 flex items-center gap-1">
                  <User className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-600" : "text-purple-600"}`} />
                  이용인 : <span className="text-gray-900">
                    {isBatchMode 
                      ? (parsedLogs[selectedBatchTab]?.name || "일괄 대상") 
                      : (name || "")}
                  </span>
                </span>
                <span className="text-gray-300">|</span>
                <span className="font-semibold text-gray-700 flex items-center gap-1">
                  <Calendar className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-600" : "text-purple-600"}`} />
                  날짜 : <span className="text-gray-900">{date || ""}</span>
                </span>
              </div>

              <div className="flex-1 bg-gray-50 rounded-xl p-4 overflow-y-auto overflow-x-hidden border border-gray-100 min-h-[300px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading-state"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center py-4 px-4 text-center select-none"
                    >
                      {/* Cute Running Dog Track Container */}
                      <div className="w-full max-w-xs relative my-8 px-4 select-none">
                        {/* Runner Buddy (Dog emoji 🐕 moving within track limits and facing right) */}
                        <div 
                          className="absolute bottom-[14px] transition-all duration-300 ease-out select-none"
                          style={{ 
                            left: `calc(12% + ${progress * 0.76}%)`,
                            transform: `translateX(-50%)`,
                          }}
                        >
                          <div className="flex flex-col items-center">
                            {/* Speech Bubble */}
                            <span className="text-[10px] bg-slate-800 text-white font-bold px-2 py-0.5 rounded-md mb-1 whitespace-nowrap relative after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-slate-800 shadow-sm">
                              {progress < 30 ? "멍멍! 출발~! 🐾💨" 
                               : progress < 65 ? "내용 수정 중! 왈왈 📝" 
                               : progress < 90 ? "꼼꼼하게 작업 중! 🐶" 
                               : "완성 직전이개! ✨"}
                            </span>
                            
                            {/* Running Dog Emoji (🐕) flipped horizontally to run to the right */}
                            <div className="animate-[bounce_0.35s_infinite_alternate] inline-block">
                              <div 
                                className="text-4xl filter drop-shadow-sm select-none"
                                style={{ transform: "scaleX(-1)", display: "inline-block" }}
                              >
                                🐕
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Track/Progress Line */}
                        <div className="h-3 w-full bg-gray-200/80 rounded-full overflow-hidden relative shadow-inner">
                          <div 
                            className={`h-full ${type === "생활일지" ? "bg-blue-600" : "bg-purple-600"} rounded-full transition-all duration-300 ease-out shadow-sm`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Percentage (Directly Below the Bar) & Guidance */}
                      <div className="space-y-1 mt-1">
                        <div className={`text-3xl font-extrabold font-mono tracking-tight ${type === "생활일지" ? "text-blue-600" : "text-purple-600"}`}>
                          {Math.round(progress)}%
                        </div>
                        <p className="text-sm text-gray-500 font-semibold leading-relaxed">
                          AI가 전문적으로 내용 수정하고 있습니다.
                        </p>
                      </div>

                      {/* Cancel & Retry Button Controls on Lag */}
                      <div className="mt-4 flex flex-col gap-1.5 w-full max-w-xs font-sans">
                        <button
                          type="button"
                          onClick={handleRetry}
                          className={`w-full py-2 ${
                            type === "생활일지" 
                              ? "bg-blue-600 hover:bg-blue-700 text-white" 
                              : "bg-purple-600 hover:bg-purple-700 text-white"
                          } text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98] flex items-center justify-center gap-1.5`}
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          서버 지연 시: 다시 시도하기
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="w-full py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          <AlertCircle className="w-3 h-3 text-gray-400" />
                          취소하고 입력내용 수정하기
                        </button>
                      </div>
                    </motion.div>
                  ) : result ? (
                    <motion.pre
                      key="result-state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 font-mono"
                    >
                      {isBatchMode && parsedLogs.length > 0
                        ? (parsedLogs[selectedBatchTab]?.content || result)
                        : result}
                    </motion.pre>
                  ) : (
                    <div key="empty-state" className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 text-center py-10">
                      <FileText className="w-12 h-12 stroke-[1.5] opacity-20" />
                      <p className="text-sm">입력 폼을 채우고 버튼을 누르면<br/>이곳에 전문적인 기록이 생성됩니다.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Decorative elements */}
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500 opacity-[0.03] rounded-full blur-2xl" />
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-500 opacity-[0.03] rounded-full blur-3xl" />
            </div>
            
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[10px] text-amber-700 leading-tight">
                * 생성된 기록은 기록 도우미(AI)가 제안하는 초안입니다. 실제 이용인의 상태를 정확히 반영하는지 반드시 직원이 최종 검토한 후 사용하시기 바랍니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Logs Drawer / Modal */}
      <CloudLogsModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        logs={savedCloudLogs}
      />
    </div>
  );
}

