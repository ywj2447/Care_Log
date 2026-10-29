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
  Trash2,
  Dog,
  Settings,
  Key,
  Eye,
  EyeOff,
  Database,
  Cloud,
  Palette,
  LogOut,
  Check,
  Sparkles,
  Users
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
  loadBatchClientsFromCloud,
  saveDraftToCloud,
  loadDraftFromCloud,
  subscribeToAuthState,
  signInWithGoogle,
  logoutUser,
  firebaseOptions,
  ManagedClient,
  subscribeToManagedClients
} from "./lib/firebase";
import { User as FirebaseUser } from "firebase/auth";
import { CloudLogsModal } from "./components/CloudLogsModal";
import { DateChangeModal } from "./components/DateChangeModal";
import { DomainAuthModal } from "./components/DomainAuthModal";
import { ManagedClientsModal } from "./components/ManagedClientsModal";
import { LIVING_LOG_KEYWORD_GROUPS, PROGRAM_LOG_KEYWORD_GROUPS } from "./constants/careKeywords";
import { CategoryHeaderWithKeywords, SimpleCategoryHeader } from "./components/CategoryHeaderWithKeywords";

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
  const [geminiModel, setGeminiModel] = useState(() => {
    const validModels = [
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemini-4-argon"
    ];
    const saved = localStorage.getItem("carelog_gemini_model");
    if (saved && validModels.includes(saved) && saved !== "gemini-3.8-flash") {
      return saved;
    }
    return "gemini-3.1-flash-lite";
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedCloudLogs, setSavedCloudLogs] = useState<SavedLogItem[]>([]);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showDomainAuthModal, setShowDomainAuthModal] = useState(false);

  // Managed clients state (up to 30)
  const [managedClients, setManagedClients] = useState<ManagedClient[]>(() => {
    try {
      const saved = localStorage.getItem("carelog_managed_clients");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  });
  const [showManagedClientsModal, setShowManagedClientsModal] = useState(false);
  const [managedClientsSelectionMode, setManagedClientsSelectionMode] = useState<"none" | "single" | "multiple">("none");
  const [targetBatchSlotIndexForSelection, setTargetBatchSlotIndexForSelection] = useState<number | null>(null);

  // Firebase Auth & Cloud Sync State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [firestoreStatus, setFirestoreStatus] = useState<"connected" | "error" | "disconnected">("disconnected");
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const lastDraftHashRef = React.useRef<string>("");

  const showNotice = (msg: string) => {
    setNotificationMessage(msg);
    setTimeout(() => {
      setNotificationMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

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
  
  // 클라우드 저장 여부 상태 (인증된 사용자만 활성화 가능, 기본값: localStorage 설정값 확인)
  const [autoSaveToCloud, setAutoSaveToCloud] = useState<boolean>(() => {
    const saved = localStorage.getItem("carelog_auto_save_cloud");
    return saved === "true";
  });

  // 날짜 변경 시 확인 모달 상태
  const [pendingDateChange, setPendingDateChange] = useState<string | null>(null);
  
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

  // 추천 키워드 열림 상태 (카테고리별 토글)
  const [openKeywordCategory, setOpenKeywordCategory] = useState<string | null>(null);

  // V 1.1 패치노트 임시 창 열림 상태 (호버 / 모바일 클릭)
  const [showPatchNote, setShowPatchNote] = useState(false);

  useEffect(() => {
    if (!showPatchNote) return;
    const handleOutsideClick = () => {
      setShowPatchNote(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, [showPatchNote]);

  const toggleKeywordCategory = (catKey: string) => {
    setOpenKeywordCategory(prev => prev === catKey ? null : catKey);
  };

  const appendKeywordText = (current: string, keyword: string) => {
    const trimmed = current.trim();
    if (!trimmed) return keyword;
    if (trimmed.endsWith(",") || trimmed.endsWith(".")) {
      return `${trimmed} ${keyword}`;
    }
    return `${trimmed}, ${keyword}`;
  };

  // 단일 모드용 키워드 추가
  const handleSingleKeywordAppend = (
    field: "transit" | "hygiene" | "diet" | "health" | "program" | "others" | "programName" | "observation" | "support" | "reaction" | "plan",
    keyword: string
  ) => {
    switch (field) {
      case "transit": setTransit(prev => appendKeywordText(prev, keyword)); break;
      case "hygiene": setHygiene(prev => appendKeywordText(prev, keyword)); break;
      case "diet": setDiet(prev => appendKeywordText(prev, keyword)); break;
      case "health": setHealth(prev => appendKeywordText(prev, keyword)); break;
      case "program": setProgram(prev => appendKeywordText(prev, keyword)); break;
      case "others": setOthers(prev => appendKeywordText(prev, keyword)); break;
      case "programName": setProgramName(prev => appendKeywordText(prev, keyword)); break;
      case "observation": setObservation(prev => appendKeywordText(prev, keyword)); break;
      case "support": setSupport(prev => appendKeywordText(prev, keyword)); break;
      case "reaction": setReaction(prev => appendKeywordText(prev, keyword)); break;
      case "plan": setPlan(prev => appendKeywordText(prev, keyword)); break;
    }
  };

  // 일괄 모드용 키워드 추가
  const handleBatchKeywordAppend = (
    field: keyof BatchClient,
    keyword: string
  ) => {
    const updated = [...batchClients];
    const curVal = (updated[activeEditIndex] && updated[activeEditIndex][field]) as string || "";
    (updated[activeEditIndex] as any)[field] = appendKeywordText(curVal, keyword);
    setBatchClients(updated);
  };

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

  // 날짜 변경 시 작성된 내용이 있는지 확인
  const checkIfHasContent = () => {
    if (isBatchMode) {
      const hasAnyClientContent = batchClients.some(c => 
        c.name.trim() || 
        c.transit?.trim() || 
        c.hygiene?.trim() || 
        c.diet?.trim() || 
        (c.health?.trim() && c.health.trim() !== "양호함 / 체온: 정상") ||
        c.program?.trim() || 
        c.others?.trim() ||
        c.programName?.trim() || 
        c.observation?.trim() || 
        c.support?.trim() || 
        c.reaction?.trim() || 
        c.plan?.trim()
      );
      return hasAnyClientContent || result.trim().length > 0;
    } else {
      const hasSingleContent = 
        name.trim() || 
        transit.trim() || 
        hygiene.trim() || 
        diet.trim() || 
        health.trim() || 
        program.trim() || 
        others.trim() ||
        programName.trim() || 
        observation.trim() || 
        support.trim() || 
        reaction.trim() || 
        plan.trim() || 
        result.trim();
      return !!hasSingleContent;
    }
  };

  // 사용자가 날짜를 변경하려고 할 때 호출
  const handleDateChangeRequest = (newDateVal: string) => {
    if (newDateVal === date) return;
    
    // 내용이 있으면 확인 모달 열기
    if (checkIfHasContent()) {
      setPendingDateChange(newDateVal);
    } else {
      // 내용이 없으면 즉시 변경
      setDate(newDateVal);
      localStorage.setItem("w_date_manually_changed", "true");
    }
  };

  // 날짜 변경 모달에서 선택한 작업 수행
  const handleConfirmDateChange = (action: "clear_all" | "keep_names" | "keep_all") => {
    if (!pendingDateChange) return;
    const targetDate = pendingDateChange;

    if (action === "clear_all") {
      // 전부 삭제 (이름 포함 완전 초기화)
      setName("");
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
    } else if (action === "keep_names") {
      // 이용인 이름만 유지하고 세부 작성 내용 및 결과 비우기
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
      setBatchClients(prev => prev.map(c => ({
        name: c.name,
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
    } else {
      // keep_all: 삭제 안 하고 날짜만 변경 (아무 것도 안 지움)
    }

    setDate(targetDate);
    localStorage.setItem("w_date_manually_changed", "true");
    setPendingDateChange(null);
  };

  // Listen to Firebase Authentication state changes
  useEffect(() => {
    const unsubscribeAuth = subscribeToAuthState((user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);

      if (!user) {
        setAutoSaveToCloud(false);
        setSavedCloudLogs([]);
      } else {
        const savedAuto = localStorage.getItem("carelog_auto_save_cloud");
        if (savedAuto === "true") {
          setAutoSaveToCloud(true);
        }
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // When user is authenticated, subscribe to user-isolated care logs and cloud batch presets
  useEffect(() => {
    if (!currentUser) {
      setSavedCloudLogs([]);
      setFirestoreStatus("disconnected");
      return;
    }

    const unsubscribeLogs = subscribeToCareLogs(
      (logs) => {
        setSavedCloudLogs(logs);
      },
      (status) => {
        setFirestoreStatus(status);
      }
    );

    // Subscribe to managed client profiles (up to 30 clients)
    const unsubscribeManaged = subscribeToManagedClients((clients) => {
      setManagedClients(clients);
      try {
        localStorage.setItem("carelog_managed_clients", JSON.stringify(clients));
      } catch {}
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
      unsubscribeLogs();
      unsubscribeManaged();
    };
  }, [currentUser]);

  // Debounced auto-save of current draft to cloud (1.5s debounce, only if autoSaveToCloud & currentUser)
  useEffect(() => {
    if (!autoSaveToCloud || !currentUser) {
      return;
    }

    const draftData = {
      date,
      type,
      name,
      transit,
      hygiene,
      diet,
      health,
      program,
      others,
      programName,
      observation,
      support,
      reaction,
      plan,
      isBatchMode,
      batchClients,
      result
    };

    const draftHash = JSON.stringify(draftData);
    if (draftHash === lastDraftHashRef.current) {
      return;
    }

    // Only save if there is some meaningful content
    const hasAnyContent = checkIfHasContent();
    if (!hasAnyContent) {
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setCloudSyncStatus("saving");
        const success = await saveDraftToCloud(draftData);
        if (!success) {
          throw new Error("Draft write was not confirmed by Firestore");
        }
        lastDraftHashRef.current = draftHash;
        setCloudSyncStatus("saved");
        setTimeout(() => {
          setCloudSyncStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 2000);
      } catch (err) {
        console.warn("Auto-save draft notice:", err);
        setCloudSyncStatus("error");
        setTimeout(() => {
          setCloudSyncStatus((prev) => (prev === "error" ? "idle" : prev));
        }, 3000);
      }
    }, 1500);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [
    autoSaveToCloud,
    currentUser,
    date,
    type,
    name,
    transit,
    hygiene,
    diet,
    health,
    program,
    others,
    programName,
    observation,
    support,
    reaction,
    plan,
    isBatchMode,
    batchClients,
    result
  ]);

  // Toggle "클라우드 보관함에 자동저장"
  const handleToggleAutoSave = async () => {
    if (!autoSaveToCloud) {
      // User wants to turn ON auto-save
      if (!currentUser) {
        try {
          const user = await signInWithGoogle();
          if (user) {
            setAutoSaveToCloud(true);
            localStorage.setItem("carelog_auto_save_cloud", "true");
            showNotice(`${user.displayName || user.email?.split("@")[0]}님 환영합니다! 클라우드 자동저장이 활성화되었습니다.`);

            // Immediately sync draft
            if (checkIfHasContent()) {
              setCloudSyncStatus("saving");
              const saved = await saveDraftToCloud({
                date,
                type,
                name,
                transit,
                hygiene,
                diet,
                health,
                program,
                others,
                programName,
                observation,
                support,
                reaction,
                plan,
                isBatchMode,
                batchClients,
                result
              });
              if (saved) {
                setCloudSyncStatus("saved");
                setTimeout(() => setCloudSyncStatus("idle"), 2500);
              } else {
                setCloudSyncStatus("error");
                setTimeout(() => setCloudSyncStatus("idle"), 3000);
              }
            }
          }
        } catch (err: any) {
          // If login failed or user cancelled popup
          setAutoSaveToCloud(false);
          localStorage.setItem("carelog_auto_save_cloud", "false");
          if (err?.code === "auth/unauthorized-domain") {
            setShowDomainAuthModal(true);
            showNotice("Firebase 승인 도메인 등록이 필요합니다. 안내 창을 확인해 주세요.");
          } else if (
            err?.code !== "auth/popup-closed-by-user" &&
            err?.code !== "auth/cancelled-popup-request"
          ) {
            showNotice(err?.message || "Google 로그인에 실패했습니다. 작성 중인 내용은 안전하게 로컬에 유지됩니다.");
          }
        }
      } else {
        // User already logged in
        setAutoSaveToCloud(true);
        localStorage.setItem("carelog_auto_save_cloud", "true");
        showNotice("클라우드 자동저장이 활성화되었습니다.");

        if (checkIfHasContent()) {
          setCloudSyncStatus("saving");
          saveDraftToCloud({
            date,
            type,
            name,
            transit,
            hygiene,
            diet,
            health,
            program,
            others,
            programName,
            observation,
            support,
            reaction,
            plan,
            isBatchMode,
            batchClients,
            result
          }).then((saved) => {
            if (saved) {
              setCloudSyncStatus("saved");
              setTimeout(() => setCloudSyncStatus("idle"), 2000);
            } else {
              setCloudSyncStatus("error");
              setTimeout(() => setCloudSyncStatus("idle"), 3000);
            }
          }).catch(() => {
            setCloudSyncStatus("error");
            setTimeout(() => setCloudSyncStatus("idle"), 3000);
          });
        }
      }
    } else {
      // User turns OFF auto-save
      setAutoSaveToCloud(false);
      localStorage.setItem("carelog_auto_save_cloud", "false");
      showNotice("클라우드 자동저장이 비활성화되었습니다. (로컬 저장은 계속 유지됩니다)");
    }
  };

  // Direct Google login (e.g. from header button or modal)
  const handleGoogleLogin = async () => {
    try {
      const user = await signInWithGoogle();
      if (user) {
        setAutoSaveToCloud(true);
        localStorage.setItem("carelog_auto_save_cloud", "true");
        showNotice(`${user.displayName || user.email?.split("@")[0]}님 환영합니다!`);
      }
    } catch (err: any) {
      if (err?.code === "auth/unauthorized-domain") {
        setShowDomainAuthModal(true);
        showNotice("Firebase 승인 도메인 등록이 필요합니다. 안내 창을 확인해 주세요.");
      } else if (
        err?.code !== "auth/popup-closed-by-user" &&
        err?.code !== "auth/cancelled-popup-request"
      ) {
        showNotice(err?.message || "로그인 중 오류가 발생했습니다.");
      }
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await logoutUser();
      setAutoSaveToCloud(false);
      localStorage.setItem("carelog_auto_save_cloud", "false");
      showNotice("로그아웃되었습니다. 로컬에 저장된 내용은 계속 유지됩니다.");
    } catch (err: any) {
      showNotice("로그아웃 처리 중 오류가 발생했습니다.");
    }
  };

  // Restore saved log from Cloud Logs Modal
  const handleSelectSavedLog = (log: SavedLogItem) => {
    if (log.date) setDate(log.date);
    if (log.type) setType(log.type);
    if (log.clientName) setName(log.clientName);
    if (log.content) setResult(log.content);
    setIsBatchMode(false);
    showNotice(`${log.clientName}님의 ${log.date} ${log.type} 기록을 불러왔습니다.`);
  };

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
    localStorage.setItem("carelog_auto_save_cloud", String(autoSaveToCloud));
  }, [name, date, type, transit, hygiene, diet, health, program, others, programName, observation, support, reaction, plan, isBatchMode, batchClients, autoSaveToCloud]);

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
      // Find traits for single mode
      const matchedClient = !isBatchMode && name.trim() 
        ? managedClients.find(c => c.name.trim() === name.trim()) 
        : undefined;
      const singleClientTraits = matchedClient ? {
        personality: matchedClient.personality,
        communication: matchedClient.communication,
        behaviorTraits: matchedClient.behaviorTraits,
        notes: matchedClient.notes
      } : undefined;

      // Find traits for batch mode clients
      const activeClients = batchClients
        .filter(c => c.name.trim() !== "")
        .map(c => {
          const matched = managedClients.find(m => m.name.trim() === c.name.trim());
          return {
            ...c,
            traits: matched ? {
              personality: matched.personality,
              communication: matched.communication,
              behaviorTraits: matched.behaviorTraits,
              notes: matched.notes
            } : undefined
          };
        });

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
          clientTraits: singleClientTraits,
          ...(isBatchMode ? { names: activeClients } : {})
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      clearInterval(progressInterval);

      if (controller.signal.aborted) {
        throw new Error("요청이 취소되었습니다.");
      }

      const contentType = response.headers.get("content-type") || "";
      let resData: any = null;

      if (contentType.includes("application/json")) {
        try {
          resData = await response.json();
        } catch {
          const text = await response.text().catch(() => "");
          resData = { error: text || `서버 응답 파싱 오류 (상태 코드: ${response.status})` };
        }
      } else {
        const text = await response.text().catch(() => "");
        if (response.status === 404) {
          resData = { 
            error: "서버의 AI 생성 API(/api/generate) 엔드포인트를 찾을 수 없습니다 (404). Vercel 배포 설정 및 환경 변수(GEMINI_API_KEY)를 확인해 주십시오." 
          };
        } else {
          resData = { 
            error: `서버 응답 형식 오류 (${response.status}): ${text.slice(0, 150) || "알 수 없는 응답입니다."}` 
          };
        }
      }

      if (!response.ok) {
        throw new Error(resData?.error || `AI 기록 생성 요청에 실패했습니다 (상태 코드: ${response.status})`);
      }

      if (resData?.error) {
        throw new Error(resData.error);
      }

      if (!resData || typeof resData.result !== "string") {
        throw new Error("AI 생성 결과 응답 형식이 올바르지 않습니다.");
      }
      
      setProgress(100);
      
      // Delay slightly to let user see 100% progress completes
      setTimeout(async () => {
        setResult(resData.result);
        setIsLoading(false);

        // Auto-save generated log to Firebase Firestore if autoSaveToCloud is enabled and user is authenticated
        if (autoSaveToCloud && currentUser) {
          try {
            setCloudSyncStatus("saving");
            let writeConfirmed = false;

            if (isBatchMode) {
              const parsed = parseBatchResult(resData.result);
              if (parsed.length > 0) {
                const savedCount = await batchSaveLogsToFirestore(
                  parsed.map((p) => ({
                    clientName: p.name,
                    date,
                    type,
                    content: p.content,
                  }))
                );
                if (savedCount > 0) {
                  writeConfirmed = true;
                }
              }
              // Auto sync batch clients preset to user-isolated cloud storage
              await saveBatchClientsToCloud(batchClients);
            } else {
              if (name && resData.result) {
                const docId = await saveLogToFirestore({
                  clientName: name,
                  date,
                  type,
                  content: resData.result,
                });
                if (docId) {
                  writeConfirmed = true;
                }
              }
            }

            if (writeConfirmed) {
              setCloudSyncStatus("saved");
              setTimeout(() => {
                setCloudSyncStatus((prev) => (prev === "saved" ? "idle" : prev));
              }, 2500);
            } else {
              setCloudSyncStatus("error");
              setTimeout(() => {
                setCloudSyncStatus((prev) => (prev === "error" ? "idle" : prev));
              }, 3000);
            }
          } catch (cloudErr) {
            console.warn("Firebase auto-save notice:", cloudErr);
            setCloudSyncStatus("error");
            setTimeout(() => {
              setCloudSyncStatus((prev) => (prev === "error" ? "idle" : prev));
            }, 3000);
          }
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
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-xl lg:max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6 lg:mb-8 flex flex-col items-center justify-center text-center gap-3">
          <div className="flex items-center justify-center gap-3">
            <div className="relative w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0 bg-white rounded-xl shadow-md transition-all duration-300 select-none hover:scale-105 overflow-hidden">
              <img
                src={carelogClLogo}
                alt="CareLog Logo"
                className="w-full h-full object-cover scale-[1.02]"
                style={{ imageRendering: "-webkit-optimize-contrast" }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="inline-flex items-end">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 leading-none">
                CareLog
              </h1>
              {/* Version badge placed immediately to the right of 'g' at the lower-right */}
              <div 
                className="relative ml-1 sm:ml-1.5 self-end flex items-end"
                onMouseEnter={() => setShowPatchNote(true)}
                onMouseLeave={() => setShowPatchNote(false)}
              >
                <button
                  type="button"
                  id="version-badge-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPatchNote((prev) => !prev);
                  }}
                  className="text-[10px] sm:text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 px-1.5 py-0.5 rounded-md border border-blue-200/80 leading-none cursor-pointer transition-all duration-150 shadow-2xs select-none translate-y-[2px] sm:translate-y-[3px] flex items-center gap-0.5 whitespace-nowrap"
                  title="Version 1.3 패치노트 확인 (클릭 또는 마우스 오버)"
                  aria-label="Version 1.3 패치노트 확인"
                >
                  Version 1.3
                </button>

                {/* Patch note temporary popover */}
                <AnimatePresence>
                  {showPatchNote && (
                    <motion.div
                      id="patchnote-popover"
                      role="dialog"
                      aria-label="CareLog Version 1.3 패치노트"
                      initial={{ opacity: 0, y: 4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full mt-2.5 z-50 w-80 sm:w-96 bg-white rounded-2xl p-4 border border-blue-200/90 shadow-2xl text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/70">
                            <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
                            Version 1.3
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">최신 업데이트</span>
                        </div>
                      </div>

                      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 text-left scrollbar-thin">
                        <div>
                          <div className="text-[11.5px] font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"></span>
                            v1.3 주요 업데이트
                          </div>
                          <ul className="text-[11px] text-gray-600 space-y-1.5 leading-relaxed font-normal">
                            <li className="flex items-start gap-1.5">
                              <span className="text-blue-500 font-bold shrink-0">•</span>
                              <span><strong className="text-gray-800 font-semibold">Gemini 3.1 Flash Lite 탑재</strong>: 기본 AI 엔진을 최신 3.1 Flash Lite로 교체하여 기록 생성 속도를 대폭 향상시키고 쿼터(429/500) 및 지연 문제를 해결했습니다.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-blue-500 font-bold shrink-0">•</span>
                              <span><strong className="text-gray-800 font-semibold">대규모 일괄 생성 최적화</strong>: Thinking(추론) 설정을 최적화하여 다수 이용인 일지 일괄 작성 시 멈춤이나 타임아웃 없이 빠르고 매끄럽게 작성됩니다.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-blue-500 font-bold shrink-0">•</span>
                              <span><strong className="text-gray-800 font-semibold">AI 모델 선택창 최신화</strong>: 구버전 모델을 정리하고 권장 최신 모델(3.1 Flash Lite, 2.5 Flash 등)을 직관적으로 확인 및 선택할 수 있도록 개편했습니다.</span>
                            </li>
                          </ul>
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                          <div className="text-[10px] font-bold text-gray-400 mb-1">이전 버전 기록</div>
                          <div className="space-y-1 text-[10.5px] text-gray-500 leading-relaxed">
                            <p>
                              <strong className="text-gray-600 font-semibold">v1.2</strong> : 담당 이용인(최대 30명) 관리 및 개인별 특징 자동 연동 기능 추가, 일지 사실성 강화
                            </p>
                            <p>
                              <strong className="text-gray-600 font-semibold">v1.1</strong> : 구글 계정 클라우드 보관함 연동 및 다중 이용인 개별 일지 분리 기능 추가
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm">
            간단한 메모를 전문적인 복지 기록으로 변환해 드립니다.
          </p>

          <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => {
                setManagedClientsSelectionMode("none");
                setShowManagedClientsModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-indigo-50/70 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 hover:border-indigo-300 shadow-xs transition-all duration-200 active:scale-95 whitespace-nowrap"
              title="담당 이용인 등록 및 행동특성 관리 (최대 30명)"
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>담당 이용인</span>
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-extrabold rounded-full">
                {managedClients.length}/30
              </span>
            </button>

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

            {/* API 키 및 모델 설정 button positioned before Google login */}
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

            {/* Google 로그인 / 사용자 프로필 */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-white pl-2.5 pr-1.5 py-1 rounded-xl border border-gray-200 shadow-xs text-xs text-gray-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="max-w-[130px] truncate font-semibold text-gray-800">
                  {currentUser.displayName || currentUser.email?.split("@")[0]}님
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                  title="로그아웃"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 hover:border-gray-300 shadow-xs transition-all duration-200 active:scale-95 whitespace-nowrap"
                title="Google 계정으로 로그인하여 클라우드 자동저장 사용"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Google 로그인</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Feedback Notification Toast */}
        <AnimatePresence>
          {notificationMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 max-w-xl lg:max-w-2xl mx-auto bg-gray-900 text-white text-xs font-medium py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-between gap-3 z-40 border border-gray-800"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{notificationMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotificationMessage(null)}
                className="text-gray-400 hover:text-white text-xs px-1.5 py-0.5"
              >
                닫기
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* API Key Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm max-w-xl lg:max-w-4xl mx-auto"
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
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-400 text-gray-700 cursor-pointer appearance-none font-medium"
                    >
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (기본 추천 - 초경량/초고속/최고 안정성)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (검증된 경량 플래시 - 빠른 속도 및 넉넉한 쿼터)</option>
                      <option value="gemini-flash-latest">Gemini Flash Latest (최신 플래시 버전 자동 반영)</option>
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (최신 플래그십 플래시 - 추론 최적화)</option>
                      <option value="gemini-4-argon">Gemini 4 Argon (고지능 심층 추론 및 복합 지시 분석)</option>
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-normal">
                    * 오류 없이 가장 빠르고 안정적인 <strong>Gemini 3.1 Flash Lite</strong>가 기본 적용됩니다. 필요에 따라 검증된 2.5 Flash, 최신 플래시 자동(Flash Latest), 심층 추론(4 Argon)을 선택할 수 있습니다.
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

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-center gap-6 lg:gap-8">
          {/* Input Section (Always keeps stable, consistent proportions) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full lg:w-[540px] xl:w-[560px] lg:shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6"
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
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                        <Calendar className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 날짜
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => handleDateChangeRequest(e.target.value)}
                        className={`w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium leading-normal focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                        <FileText className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 기록 유형
                      </label>
                      <div className="relative">
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as LogType)}
                          className={`w-full h-10 appearance-none px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium leading-normal focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all cursor-pointer pr-9`}
                        >
                          <option value="생활일지">생활일지</option>
                          <option value="프로그램일지">프로그램일지</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Cohesive Batch Mode Workspace */}
                  <div className="space-y-4 p-4 sm:p-5 bg-gray-50/50 rounded-2xl border border-gray-200/60 shadow-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <User className={`w-4 h-4 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"}`} />
                        이용인 등록 및 개별 내용 입력 (최대 6명)
                      </span>
                      <div className="flex items-center gap-2">
                        {managedClients.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setManagedClientsSelectionMode("multiple");
                              setShowManagedClientsModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shadow-2xs"
                            title="등록된 담당 이용인 목록에서 오늘 참여한 인원들을 한 번에 선택하여 슬롯에 배치합니다"
                          >
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            <span>담당 이용인 일괄 불러오기</span>
                          </button>
                        )}
                        <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">이름이 입력된 대상만 생성</span>
                      </div>
                    </div>

                    {/* Quick Selection Slider Grid with Progress - Always fixed 3 cols */}
                    <div className="grid grid-cols-3 gap-2 bg-gray-200/40 p-2 rounded-xl">
                      {batchClients.map((client, idx) => {
                        const filled = getFilledCount(client, type);
                        const total = type === "생활일지" ? 6 : 5;
                        const isNameEntered = client.name.trim().length > 0;
                        const isSelected = activeEditIndex === idx;
                        const isMatchedTrait = isNameEntered && managedClients.some(m => m.name.trim() === client.name.trim());
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveEditIndex(idx)}
                            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all border flex items-center justify-center gap-1.5 relative shadow-2xs whitespace-nowrap ${
                              isSelected
                                ? type === "생활일지"
                                ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                                : "bg-purple-600 border-purple-600 text-white shadow-xs"
                                : isNameEntered
                                  ? "bg-white border-gray-200 text-gray-800 hover:bg-gray-100 hover:border-gray-300"
                                  : "bg-gray-100/40 border-dashed border-gray-200 text-gray-400 hover:bg-gray-50 hover:border-gray-300"
                            }`}
                          >
                            <span className="text-[10px] opacity-75 font-semibold shrink-0">#{idx + 1}</span>
                            <span className="truncate text-xs font-extrabold max-w-[65px] sm:max-w-none">
                              {client.name.trim() || "미등록"}
                            </span>
                            {isMatchedTrait && (
                              <Sparkles className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                            )}
                            <span className={`text-[9px] px-1 py-0.5 font-bold rounded shrink-0 ${
                              isSelected 
                                ? "bg-white/20 text-white" 
                                : isNameEntered
                                  ? filled === total
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-gray-100 text-gray-600"
                                  : "bg-gray-200/60 text-gray-400"
                            }`}>
                              {filled}/{total}
                            </span>
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

                      {/* Name Row with Managed Client Selection */}
                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-500">성함</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetBatchSlotIndexForSelection(activeEditIndex);
                              setManagedClientsSelectionMode("single");
                              setShowManagedClientsModal(true);
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Users className="w-3 h-3" />
                            <span>담당 이용인에서 선택</span>
                          </button>
                        </div>
                        
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

                        {/* Display Trait Notice if Matched */}
                        {(() => {
                          const currentName = batchClients[activeEditIndex]?.name?.trim();
                          const matched = currentName ? managedClients.find(m => m.name.trim() === currentName) : null;
                          if (!matched) return null;
                          return (
                            <div className="mt-1 p-2 bg-indigo-50/70 rounded-lg border border-indigo-100 text-[11px] text-indigo-900 flex items-start gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                              <div className="leading-tight">
                                <span className="font-extrabold text-indigo-800">특징 참고 연동됨: </span>
                                {matched.personality && <span className="mr-1.5">성향({matched.personality})</span>}
                                {matched.communication && <span className="mr-1.5">소통({matched.communication})</span>}
                                {matched.behaviorTraits && <span>주의({matched.behaviorTraits})</span>}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {!batchClients[activeEditIndex]?.name.trim() && (
                        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 text-[11px] text-amber-700 font-semibold mb-3 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>성함을 입력해야 개별 인공지능(AI) 일지가 생성됩니다.</span>
                        </div>
                      )}

                      {/* Detailed Inputs per Active Client */}
                      <div className="pt-3 border-t border-gray-150 space-y-4">
                        {type === "생활일지" ? (
                          <>
                            {/* 입퇴소 및 송영 */}
                            <div className="space-y-1.5">
                              <CategoryHeaderWithKeywords
                                label="입퇴소 및 송영"
                                categoryKey="batch_transit"
                                groups={LIVING_LOG_KEYWORD_GROUPS.transit}
                                isOpen={openKeywordCategory === "batch_transit"}
                                onToggle={() => toggleKeywordCategory("batch_transit")}
                                onSelectKeyword={(kw) => handleBatchKeywordAppend("transit", kw)}
                                badgeColor="blue"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.transit || "";
                                  const updated = batchClients.map(c => ({ ...c, transit: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={2}
                                lang="ko"
                                placeholder="예: 송영차량 이용, 보호자 직접 등원"
                                value={batchClients[activeEditIndex]?.transit || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].transit = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[58px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>

                            {/* 위생 및 청결 */}
                            <div className="space-y-1.5">
                              <CategoryHeaderWithKeywords
                                label="위생 및 청결"
                                categoryKey="batch_hygiene"
                                groups={LIVING_LOG_KEYWORD_GROUPS.hygiene}
                                isOpen={openKeywordCategory === "batch_hygiene"}
                                onToggle={() => toggleKeywordCategory("batch_hygiene")}
                                onSelectKeyword={(kw) => handleBatchKeywordAppend("hygiene", kw)}
                                badgeColor="blue"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.hygiene || "";
                                  const updated = batchClients.map(c => ({ ...c, hygiene: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={2}
                                lang="ko"
                                placeholder="예: 스스로 손씻기 수행, 세수 지원, 환의 도움"
                                value={batchClients[activeEditIndex]?.hygiene || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].hygiene = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[58px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>

                            {/* 식생활 */}
                            <div className="space-y-1.5">
                              <CategoryHeaderWithKeywords
                                label="식생활"
                                categoryKey="batch_diet"
                                groups={LIVING_LOG_KEYWORD_GROUPS.diet}
                                isOpen={openKeywordCategory === "batch_diet"}
                                onToggle={() => toggleKeywordCategory("batch_diet")}
                                onSelectKeyword={(kw) => handleBatchKeywordAppend("diet", kw)}
                                badgeColor="blue"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.diet || "";
                                  const updated = batchClients.map(c => ({ ...c, diet: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={2}
                                lang="ko"
                                placeholder="예: 전량 섭취, 생선 위주로 식사, 숟가락 사용 지원"
                                value={batchClients[activeEditIndex]?.diet || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].diet = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[58px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>

                            {/* 건강관리 */}
                            <div className="space-y-1.5">
                              <CategoryHeaderWithKeywords
                                label="건강관리"
                                categoryKey="batch_health"
                                groups={LIVING_LOG_KEYWORD_GROUPS.health}
                                isOpen={openKeywordCategory === "batch_health"}
                                onToggle={() => toggleKeywordCategory("batch_health")}
                                onSelectKeyword={(kw) => handleBatchKeywordAppend("health", kw)}
                                badgeColor="blue"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.health || "";
                                  const updated = batchClients.map(c => ({ ...c, health: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={2}
                                lang="ko"
                                placeholder="예: 양호함 / 체온: 36.5 정상, 투약 지원"
                                value={batchClients[activeEditIndex]?.health || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].health = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[58px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>

                            {/* 프로그램 */}
                            <div className="space-y-1.5">
                              <SimpleCategoryHeader
                                label="프로그램"
                                badgeText="직접 입력"
                                badgeColor="blue"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.program || "";
                                  const updated = batchClients.map(c => ({ ...c, program: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={2}
                                lang="ko"
                                placeholder="예: 동화구연, 미술활동 참여"
                                value={batchClients[activeEditIndex]?.program || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].program = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[58px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>

                            {/* 기타사항 */}
                            <div className="space-y-1.5">
                              <CategoryHeaderWithKeywords
                                label="기타사항"
                                categoryKey="batch_others"
                                groups={LIVING_LOG_KEYWORD_GROUPS.others}
                                isOpen={openKeywordCategory === "batch_others"}
                                onToggle={() => toggleKeywordCategory("batch_others")}
                                onSelectKeyword={(kw) => handleBatchKeywordAppend("others", kw)}
                                badgeColor="blue"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.others || "";
                                  const updated = batchClients.map(c => ({ ...c, others: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={3}
                                lang="ko"
                                placeholder="동료와의 상호작용, 기분 상태, 특이사항 기재"
                                value={batchClients[activeEditIndex]?.others || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].others = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[72px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            {/* 프로그램명 */}
                            <div className="space-y-1.5">
                              <SimpleCategoryHeader
                                label="프로그램명"
                                badgeText="직접 입력"
                                badgeColor="purple"
                                icon={<Palette className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.programName || "";
                                  const updated = batchClients.map(c => ({ ...c, programName: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={2}
                                lang="ko"
                                placeholder="프로그램 제목을 입력하세요 (예: 종이접기 교실, 신체활동)"
                                value={batchClients[activeEditIndex]?.programName || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].programName = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[54px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>

                            {/* 관찰내용 */}
                            <div className="space-y-1.5">
                              <CategoryHeaderWithKeywords
                                label="관찰내용"
                                categoryKey="batch_observation"
                                groups={PROGRAM_LOG_KEYWORD_GROUPS.observation}
                                isOpen={openKeywordCategory === "batch_observation"}
                                onToggle={() => toggleKeywordCategory("batch_observation")}
                                onSelectKeyword={(kw) => handleBatchKeywordAppend("observation", kw)}
                                badgeColor="purple"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.observation || "";
                                  const updated = batchClients.map(c => ({ ...c, observation: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={4}
                                lang="ko"
                                placeholder="이용인의 실제 참여 태도, 활동 과정, 행동 양상 등 관찰된 내용을 자유롭게 기재해 주세요."
                                value={batchClients[activeEditIndex]?.observation || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].observation = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[96px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>

                            {/* 지원내용 */}
                            <div className="space-y-1.5">
                              <CategoryHeaderWithKeywords
                                label="지원내용"
                                categoryKey="batch_support"
                                groups={PROGRAM_LOG_KEYWORD_GROUPS.support}
                                isOpen={openKeywordCategory === "batch_support"}
                                onToggle={() => toggleKeywordCategory("batch_support")}
                                onSelectKeyword={(kw) => handleBatchKeywordAppend("support", kw)}
                                badgeColor="purple"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.support || "";
                                  const updated = batchClients.map(c => ({ ...c, support: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={3}
                                lang="ko"
                                placeholder="직원의 개입, 언어적 촉구, 신체적 보조 등 지원 사항 기재"
                                value={batchClients[activeEditIndex]?.support || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].support = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[72px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>

                            {/* 의미 있는 반응 */}
                            <div className="space-y-1.5">
                              <CategoryHeaderWithKeywords
                                label="의미 있는 반응"
                                categoryKey="batch_reaction"
                                groups={PROGRAM_LOG_KEYWORD_GROUPS.reaction}
                                isOpen={openKeywordCategory === "batch_reaction"}
                                onToggle={() => toggleKeywordCategory("batch_reaction")}
                                onSelectKeyword={(kw) => handleBatchKeywordAppend("reaction", kw)}
                                badgeColor="purple"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.reaction || "";
                                  const updated = batchClients.map(c => ({ ...c, reaction: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={3}
                                lang="ko"
                                placeholder="성취감 표현, 웃음, 작은 긍정적 변화나 반응"
                                value={batchClients[activeEditIndex]?.reaction || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].reaction = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[72px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>

                            {/* 차주 지원계획 */}
                            <div className="space-y-1.5">
                              <CategoryHeaderWithKeywords
                                label="차주 지원계획"
                                categoryKey="batch_plan"
                                groups={PROGRAM_LOG_KEYWORD_GROUPS.plan}
                                isOpen={openKeywordCategory === "batch_plan"}
                                onToggle={() => toggleKeywordCategory("batch_plan")}
                                onSelectKeyword={(kw) => handleBatchKeywordAppend("plan", kw)}
                                badgeColor="purple"
                                onCopyAll={() => {
                                  const val = batchClients[activeEditIndex]?.plan || "";
                                  const updated = batchClients.map(c => ({ ...c, plan: val }));
                                  setBatchClients(updated);
                                }}
                              />
                              <HangulTextarea
                                rows={3}
                                lang="ko"
                                placeholder="난이도 조절, 개별 맞춤 도구 제공 등 다음 실천 계획"
                                value={batchClients[activeEditIndex]?.plan || ""}
                                onChange={(e: any) => {
                                  const updated = [...batchClients];
                                  updated[activeEditIndex].plan = e.target.value;
                                  setBatchClients(updated);
                                }}
                                className="w-full min-h-[72px] p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                        <User className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 이름
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setManagedClientsSelectionMode("single");
                          setShowManagedClientsModal(true);
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>담당 이용인에서 선택</span>
                      </button>
                    </div>

                    <HangulInput
                      type="text"
                      lang="ko"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="이용인 성함 (예: 김OO)"
                      value={name}
                      onChange={(e: any) => setName(e.target.value)}
                      className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all placeholder:text-gray-400 font-bold`}
                    />

                    {/* Display Trait Notice if Matched */}
                    {(() => {
                      const trimmedName = name.trim();
                      const matched = trimmedName ? managedClients.find(m => m.name.trim() === trimmedName) : null;
                      if (!matched) return null;
                      return (
                        <div className="mt-1 p-2 bg-indigo-50/70 rounded-lg border border-indigo-100 text-[11px] text-indigo-900 flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                          <div className="leading-tight">
                            <span className="font-extrabold text-indigo-800">특징 참고 연동됨: </span>
                            {matched.personality && <span className="mr-1.5">성향({matched.personality})</span>}
                            {matched.communication && <span className="mr-1.5">소통({matched.communication})</span>}
                            {matched.behaviorTraits && <span>주의({matched.behaviorTraits})</span>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                        <Calendar className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 날짜
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => handleDateChangeRequest(e.target.value)}
                        className={`w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium leading-normal focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold flex items-center gap-1.5 text-gray-600">
                        <FileText className={`w-3.5 h-3.5 ${type === "생활일지" ? "text-blue-500" : "text-purple-500"} transition-colors`} /> 기록 유형
                      </label>
                      <div className="relative">
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as LogType)}
                          className={`w-full h-10 appearance-none px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium leading-normal focus:ring-2 ${type === "생활일지" ? "focus:ring-blue-500" : "focus:ring-purple-500"} focus:border-transparent outline-none transition-all cursor-pointer pr-9`}
                        >
                          <option value="생활일지">생활일지</option>
                          <option value="프로그램일지">프로그램일지</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {type === "생활일지" ? (
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                      <div className="space-y-1.5">
                        <CategoryHeaderWithKeywords
                          label="입퇴소 및 송영"
                          categoryKey="single_transit"
                          groups={LIVING_LOG_KEYWORD_GROUPS.transit}
                          isOpen={openKeywordCategory === "single_transit"}
                          onToggle={() => toggleKeywordCategory("single_transit")}
                          onSelectKeyword={(kw) => handleSingleKeywordAppend("transit", kw)}
                          badgeColor="blue"
                        />
                        <HangulTextarea
                          rows={2}
                          lang="ko"
                          placeholder="예: 송영차량 이용, 보호자 직접 등원"
                          value={transit}
                          onChange={(e: any) => setTransit(e.target.value)}
                          className="w-full min-h-[58px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <CategoryHeaderWithKeywords
                          label="위생 및 청결"
                          categoryKey="single_hygiene"
                          groups={LIVING_LOG_KEYWORD_GROUPS.hygiene}
                          isOpen={openKeywordCategory === "single_hygiene"}
                          onToggle={() => toggleKeywordCategory("single_hygiene")}
                          onSelectKeyword={(kw) => handleSingleKeywordAppend("hygiene", kw)}
                          badgeColor="blue"
                        />
                        <HangulTextarea
                          rows={2}
                          lang="ko"
                          placeholder="예: 스스로 손씻기 수행, 세수 지원, 환의 도움"
                          value={hygiene}
                          onChange={(e: any) => setHygiene(e.target.value)}
                          className="w-full min-h-[58px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <CategoryHeaderWithKeywords
                          label="식생활"
                          categoryKey="single_diet"
                          groups={LIVING_LOG_KEYWORD_GROUPS.diet}
                          isOpen={openKeywordCategory === "single_diet"}
                          onToggle={() => toggleKeywordCategory("single_diet")}
                          onSelectKeyword={(kw) => handleSingleKeywordAppend("diet", kw)}
                          badgeColor="blue"
                        />
                        <HangulTextarea
                          rows={2}
                          lang="ko"
                          placeholder="예: 전량 섭취, 생선 위주로 식사, 숟가락 사용 보조"
                          value={diet}
                          onChange={(e: any) => setDiet(e.target.value)}
                          className="w-full min-h-[58px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>
                      {/* 건강관리 */}
                      <div className="space-y-1.5">
                        <CategoryHeaderWithKeywords
                          label="건강관리"
                          categoryKey="single_health"
                          groups={LIVING_LOG_KEYWORD_GROUPS.health}
                          isOpen={openKeywordCategory === "single_health"}
                          onToggle={() => toggleKeywordCategory("single_health")}
                          onSelectKeyword={(kw) => handleSingleKeywordAppend("health", kw)}
                          badgeColor="blue"
                        />
                        <HangulTextarea
                          rows={2}
                          lang="ko"
                          placeholder="예: 양호함 / 체온: 36.5 정상, 투약 지원"
                          value={health}
                          onChange={(e: any) => setHealth(e.target.value)}
                          className="w-full min-h-[58px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>

                      {/* 프로그램 */}
                      <div className="space-y-1.5">
                        <SimpleCategoryHeader
                          label="프로그램"
                          badgeText="직접 입력"
                          badgeColor="blue"
                        />
                        <HangulTextarea
                          rows={2}
                          lang="ko"
                          placeholder="예: 동화구연, 미술 프로그램 참여"
                          value={program}
                          onChange={(e: any) => setProgram(e.target.value)}
                          className="w-full min-h-[58px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <CategoryHeaderWithKeywords
                          label="기타사항"
                          categoryKey="single_others"
                          groups={LIVING_LOG_KEYWORD_GROUPS.others}
                          isOpen={openKeywordCategory === "single_others"}
                          onToggle={() => toggleKeywordCategory("single_others")}
                          onSelectKeyword={(kw) => handleSingleKeywordAppend("others", kw)}
                          badgeColor="blue"
                        />
                        <HangulTextarea
                          rows={3}
                          lang="ko"
                          placeholder="동료와의 상호작용, 기분 상태, 특이사항 기재"
                          value={others}
                          onChange={(e: any) => setOthers(e.target.value)}
                          className="w-full min-h-[76px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                      <div className="space-y-1.5">
                        <SimpleCategoryHeader
                          label="프로그램명"
                          badgeText="직접 입력"
                          badgeColor="purple"
                          icon={<Palette className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                        />
                        <HangulTextarea
                          rows={2}
                          lang="ko"
                          placeholder="프로그램 제목을 입력하세요 (예: 종이접기 교실, 인지활동)"
                          value={programName}
                          onChange={(e: any) => setProgramName(e.target.value)}
                          className="w-full min-h-[54px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <CategoryHeaderWithKeywords
                          label="관찰내용"
                          categoryKey="single_observation"
                          groups={PROGRAM_LOG_KEYWORD_GROUPS.observation}
                          isOpen={openKeywordCategory === "single_observation"}
                          onToggle={() => toggleKeywordCategory("single_observation")}
                          onSelectKeyword={(kw) => handleSingleKeywordAppend("observation", kw)}
                          badgeColor="purple"
                        />
                        <HangulTextarea
                          rows={4}
                          lang="ko"
                          placeholder="이용인의 실제 참여 태도, 활동 과정, 행동 양상 등 관찰된 내용을 자유롭게 기재해 주세요."
                          value={observation}
                          onChange={(e: any) => setObservation(e.target.value)}
                          className="w-full min-h-[105px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <CategoryHeaderWithKeywords
                          label="지원내용"
                          categoryKey="single_support"
                          groups={PROGRAM_LOG_KEYWORD_GROUPS.support}
                          isOpen={openKeywordCategory === "single_support"}
                          onToggle={() => toggleKeywordCategory("single_support")}
                          onSelectKeyword={(kw) => handleSingleKeywordAppend("support", kw)}
                          badgeColor="purple"
                        />
                        <HangulTextarea
                          rows={3}
                          lang="ko"
                          placeholder="직원의 개입, 언어적 촉구, 신체적 보조 등 지원 사항 기재"
                          value={support}
                          onChange={(e: any) => setSupport(e.target.value)}
                          className="w-full min-h-[76px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>
                      {/* 의미 있는 반응 */}
                      <div className="space-y-1.5">
                        <CategoryHeaderWithKeywords
                          label="의미 있는 반응"
                          categoryKey="single_reaction"
                          groups={PROGRAM_LOG_KEYWORD_GROUPS.reaction}
                          isOpen={openKeywordCategory === "single_reaction"}
                          onToggle={() => toggleKeywordCategory("single_reaction")}
                          onSelectKeyword={(kw) => handleSingleKeywordAppend("reaction", kw)}
                          badgeColor="purple"
                        />
                        <HangulTextarea
                          rows={3}
                          lang="ko"
                          placeholder="성취감 표현, 웃음, 작은 긍정적 변화나 반응"
                          value={reaction}
                          onChange={(e: any) => setReaction(e.target.value)}
                          className="w-full min-h-[76px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
                      </div>

                      {/* 차주 지원계획 */}
                      <div className="space-y-1.5">
                        <CategoryHeaderWithKeywords
                          label="차주 지원계획"
                          categoryKey="single_plan"
                          groups={PROGRAM_LOG_KEYWORD_GROUPS.plan}
                          isOpen={openKeywordCategory === "single_plan"}
                          onToggle={() => toggleKeywordCategory("single_plan")}
                          onSelectKeyword={(kw) => handleSingleKeywordAppend("plan", kw)}
                          badgeColor="purple"
                        />
                        <HangulTextarea
                          rows={3}
                          lang="ko"
                          placeholder="난이도 조절, 개별 맞춤 도구 제공 등 다음 실천 계획"
                          value={plan}
                          onChange={(e: any) => setPlan(e.target.value)}
                          className="w-full min-h-[76px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all overflow-y-auto resize-y"
                        />
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

              {/* 클라우드 저장 여부 체크박스 카드 */}
              <div 
                id="auto-save-to-cloud-card"
                onClick={handleToggleAutoSave}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                  autoSaveToCloud 
                    ? "bg-blue-50/70 border-blue-200/90 shadow-xs hover:bg-blue-50" 
                    : "bg-gray-50/80 border-gray-200 hover:bg-gray-100/70 text-gray-500"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                    autoSaveToCloud ? "bg-blue-600 text-white shadow-xs" : "bg-gray-200 text-gray-400"
                  }`}>
                    {cloudSyncStatus === "saving" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Cloud className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold ${autoSaveToCloud ? "text-gray-900" : "text-gray-700"}`}>
                        클라우드 보관함에 자동 저장
                      </span>
                      {/* 상태 표시 배지 */}
                      {cloudSyncStatus === "saving" && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          저장 중...
                        </span>
                      )}
                      {cloudSyncStatus === "saved" && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          클라우드에 저장됨
                        </span>
                      )}
                      {cloudSyncStatus === "error" && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          저장 실패 (로컬 보존됨)
                        </span>
                      )}
                      {cloudSyncStatus === "idle" && (
                        <>
                          {autoSaveToCloud && currentUser ? (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800">
                              ☁ 클라우드 자동저장 중
                            </span>
                          ) : autoSaveToCloud && !currentUser ? (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">
                              로그인 필요
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-500">
                              저장 OFF
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                      {autoSaveToCloud 
                        ? currentUser
                          ? `${currentUser.displayName || currentUser.email?.split("@")[0]}님의 Firebase 클라우드 공간에 작성 초안과 생성 일지가 자동 백업됩니다.`
                          : "클라우드 저장을 활성화하려면 Google 로그인이 필요합니다."
                        : "클라우드에 저장하지 않고 일지를 1회성으로 생성합니다."}
                    </p>
                  </div>
                </div>

                <div className="relative inline-flex items-center shrink-0">
                  <input
                    type="checkbox"
                    checked={autoSaveToCloud}
                    onChange={handleToggleAutoSave}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
              </div>

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

          {/* Output Section (Moves to right on wide screens, stays below on small screens) */}
          <div className="flex-1 w-full min-w-0 flex flex-col lg:sticky lg:top-8">
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 flex flex-col relative overflow-hidden min-h-[400px]">
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
        currentUser={currentUser}
        firestoreStatus={firestoreStatus}
        projectId={firebaseOptions.projectId}
        onLoginRequest={handleGoogleLogin}
        onSelectLog={handleSelectSavedLog}
        onLogsChanged={(updated) => setSavedCloudLogs(updated)}
      />

      {/* Domain Authorization Guide Modal */}
      <DomainAuthModal
        isOpen={showDomainAuthModal}
        onClose={() => setShowDomainAuthModal(false)}
        projectId={firebaseOptions.projectId}
      />

      {/* Date Change Confirmation Modal */}
      <AnimatePresence>
        {pendingDateChange && (
          <DateChangeModal
            currentDate={date}
            newDate={pendingDateChange}
            hasContent={checkIfHasContent()}
            onConfirm={handleConfirmDateChange}
            onCancel={() => setPendingDateChange(null)}
          />
        )}
      </AnimatePresence>

      {/* Managed Clients Modal (Up to 30 clients) */}
      <ManagedClientsModal
        isOpen={showManagedClientsModal}
        onClose={() => {
          setShowManagedClientsModal(false);
          setTargetBatchSlotIndexForSelection(null);
        }}
        clients={managedClients}
        selectionMode={managedClientsSelectionMode}
        isLoggedIn={!!currentUser}
        onOpenLogin={handleGoogleLogin}
        onSelectClient={(client) => {
          if (isBatchMode && targetBatchSlotIndexForSelection !== null) {
            const updated = [...batchClients];
            if (updated[targetBatchSlotIndexForSelection]) {
              updated[targetBatchSlotIndexForSelection].name = client.name;
              setBatchClients(updated);
            }
          } else {
            setName(client.name);
          }
          setShowManagedClientsModal(false);
          setTargetBatchSlotIndexForSelection(null);
          showNotice(`'${client.name}' 이용인이 선택되었습니다.`);
        }}
        onSelectMultipleClients={(selected) => {
          if (selected.length > 0) {
            const updated = [...batchClients];
            selected.forEach((client, idx) => {
              if (idx < updated.length) {
                updated[idx].name = client.name;
              }
            });
            setBatchClients(updated);
            showNotice(`${selected.length}명의 담당 이용인이 일괄 슬롯에 배치되었습니다.`);
          }
        }}
      />
    </div>
  );
}

