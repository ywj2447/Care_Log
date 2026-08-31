import React, { useState } from "react";
import { 
  X, 
  Trash2, 
  Copy, 
  Check, 
  Calendar, 
  User as UserIcon, 
  FileText, 
  Search, 
  Database, 
  Clock,
  AlertTriangle,
  CheckSquare,
  Square,
  Cloud,
  ArrowDownToLine,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "firebase/auth";
import { 
  SavedLogItem, 
  deleteLogFromFirestore, 
  deleteMultipleLogsFromFirestore, 
  deleteAllLogsFromFirestore 
} from "../lib/firebase";

interface CloudLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SavedLogItem[];
  currentUser?: User | null;
  firestoreStatus?: "connected" | "error" | "disconnected";
  projectId?: string;
  onLoginRequest?: () => void;
  onSelectLog?: (log: SavedLogItem) => void;
  onLogsChanged?: (updatedLogs: SavedLogItem[]) => void;
}

export const CloudLogsModal: React.FC<CloudLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  currentUser,
  firestoreStatus = "disconnected",
  projectId = "carelog-dfd39",
  onLoginRequest,
  onSelectLog,
  onLogsChanged
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<"ALL" | "생활일지" | "프로그램일지">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Custom in-app confirmation modal states (No window.confirm!)
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    type: "single" | "selected" | "all";
    id?: string;
    count?: number;
    name?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      (log.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.date || "").includes(searchTerm) ||
      (log.content || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "ALL" || log.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  // Toggle single item selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all filtered items selection
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLogs.length && filteredLogs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLogs.map((l) => l.id || "").filter(Boolean)));
    }
  };

  // Execute deletion confirmed by user
  const handleExecuteDelete = async () => {
    if (!confirmDeleteTarget) return;
    setIsDeleting(true);

    try {
      if (confirmDeleteTarget.type === "single" && confirmDeleteTarget.id) {
        const idToDelete = confirmDeleteTarget.id;
        await deleteLogFromFirestore(idToDelete);
        const nextLogs = logs.filter((l) => l.id !== idToDelete);
        if (onLogsChanged) onLogsChanged(nextLogs);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(idToDelete);
          return next;
        });
        showFeedback("일지 1건이 성공적으로 삭제되었습니다.");
      } else if (confirmDeleteTarget.type === "selected") {
        const idsArray: string[] = Array.from(selectedIds);
        await deleteMultipleLogsFromFirestore(idsArray);
        const nextLogs = logs.filter((l) => !selectedIds.has(l.id || ""));
        if (onLogsChanged) onLogsChanged(nextLogs);
        setSelectedIds(new Set());
        showFeedback(`선택한 ${idsArray.length}건의 일지가 삭제되었습니다.`);
      } else if (confirmDeleteTarget.type === "all") {
        await deleteAllLogsFromFirestore();
        if (onLogsChanged) onLogsChanged([]);
        setSelectedIds(new Set());
        showFeedback("클라우드 보관함의 모든 일지가 삭제되었습니다.");
      }
    } catch (err) {
      console.warn("Deletion notice:", err);
      showFeedback("삭제 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsDeleting(false);
      setConfirmDeleteTarget(null);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return "";
    try {
      if (typeof ts.toDate === "function") {
        const d = ts.toDate();
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
      if (ts.seconds) {
        const d = new Date(ts.seconds * 1000);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    } catch (e) {}
    return "";
  };

  const isAllSelected = filteredLogs.length > 0 && selectedIds.size === filteredLogs.length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden relative"
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  Firebase 클라우드 일지 보관함
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    currentUser && firestoreStatus === "connected"
                      ? "bg-emerald-100 text-emerald-800" 
                      : currentUser && firestoreStatus === "error"
                      ? "bg-rose-100 text-rose-800"
                      : currentUser
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {currentUser && firestoreStatus === "connected"
                      ? "실시간 동기화 완료"
                      : currentUser && firestoreStatus === "error"
                      ? "연동 확인 필요"
                      : currentUser
                      ? "클라우드 연결 중"
                      : "로그인 필요"}
                  </span>
                </h3>
                <p className="text-xs text-gray-500">
                  {currentUser ? (
                    <>
                      <strong className="text-gray-800">{currentUser.displayName || currentUser.email}</strong>님의 보관 기록 (총 <strong className="text-blue-700">{logs.length}</strong>건)
                    </>
                  ) : (
                    "클라우드 보관함을 이용하려면 Google 로그인이 필요합니다."
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback Toast Notification */}
          <AnimatePresence>
            {feedbackMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-600 text-white text-xs font-semibold py-2 px-4 text-center flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>{feedbackMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search, Filter & Bulk Management Bar */}
          {!currentUser ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-gray-50/40 min-h-[350px]">
              <div className="w-16 h-16 bg-blue-100/80 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xs">
                <Cloud className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5">
                클라우드 보관함은 로그인이 필요합니다
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
                Google 계정으로 로그인하시면 작성한 일지가 안전하게 클라우드에 자동 백업되며, 다른 기기에서도 언제든지 불러와서 작업할 수 있습니다.
              </p>
              {onLoginRequest && (
                <button
                  type="button"
                  onClick={onLoginRequest}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2.5 active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Google 계정으로 로그인</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="p-3.5 border-b border-gray-100 bg-white flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="이용인 이름, 날짜, 내용 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="flex bg-gray-100 p-1 rounded-xl gap-1 shrink-0">
                    {(["ALL", "생활일지", "프로그램일지"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedType(t)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                          selectedType === t
                            ? "bg-white text-gray-900 shadow-xs"
                            : "text-gray-500 hover:text-gray-800"
                        }`}
                      >
                        {t === "ALL" ? "전체" : t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bulk Selection & Action Controls */}
                {filteredLogs.length > 0 && (
                  <div className="flex items-center justify-between pt-1 text-xs text-gray-600 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 font-medium hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                      <span>
                        {isAllSelected ? "전체 선택 해제" : "전체 선택"} ({selectedIds.size}/{filteredLogs.length})
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      {selectedIds.size > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteTarget({
                              type: "selected",
                              count: selectedIds.size,
                            })
                          }
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>선택한 {selectedIds.size}건 삭제</span>
                        </button>
                      )}
                      {logs.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteTarget({
                              type: "all",
                              count: logs.length,
                            })
                          }
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
                        >
                          보관함 전체 비우기
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Logs List Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-gray-50/40">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-gray-400" />
                    <p className="text-sm font-semibold text-gray-600">
                      {searchTerm ? "검색 결과와 일치하는 일지가 없습니다." : "저장된 일지 기록이 없습니다."}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      일지를 생성할 때 '클라우드 자동 저장'이 켜져 있으면 이곳에 안전하게 보관됩니다.
                    </p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const logId = log.id || Math.random().toString();
                    const isLiving = log.type === "생활일지";
                    const isCopied = copiedId === logId;
                    const isSelected = selectedIds.has(logId);

                    return (
                      <motion.div
                        key={logId}
                        layout
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`bg-white rounded-xl border p-4 shadow-xs transition-all ${
                          isSelected
                            ? "border-blue-300 ring-2 ring-blue-50"
                            : "border-gray-200/90 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-gray-100 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Checkbox for bulk deletion */}
                            <button
                              type="button"
                              onClick={() => toggleSelect(logId)}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />
                              )}
                            </button>

                            <span
                              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                                isLiving
                                  ? "bg-blue-50 text-blue-700 border border-blue-200/50"
                                  : "bg-purple-50 text-purple-700 border border-purple-200/50"
                              }`}
                            >
                              {log.type}
                            </span>
                            <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                              <UserIcon className="w-3 h-3 text-gray-400" />
                              {log.clientName}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {log.date}
                            </span>
                            {log.createdAt && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5 ml-1">
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(log.createdAt)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {onSelectLog && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectLog(log);
                                  onClose();
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all active:scale-95"
                                title="이 기록을 작성 화면으로 불러오기"
                              >
                                <ArrowDownToLine className="w-3 h-3" />
                                <span>불러오기</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopy(logId, log.content)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all ${
                                isCopied
                                  ? "bg-emerald-500 text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                            >
                              {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {isCopied ? "복사됨" : "복사"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteTarget({
                                  type: "single",
                                  id: logId,
                                  name: `${log.clientName} (${log.date})`,
                                })
                              }
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="이 기록 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="bg-gray-50/70 p-3 rounded-lg text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans border border-gray-100">
                          {log.content}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Modal Footer */}
          <div className="p-3.5 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-2">
              {currentUser && firestoreStatus === "connected" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                    Firebase Firestore 실시간 연동됨 ({projectId} / (default))
                  </span>
                </>
              ) : currentUser && firestoreStatus === "error" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-rose-600 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    Firestore 동기화 오류 (설정을 확인해 주세요)
                  </span>
                </>
              ) : currentUser ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-blue-500" />
                    Firestore 실시간 동기화 연결 중...
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-gray-400" />
                    Google 로그인 후 Firestore 실시간 연동 활성화
                  </span>
                </>
              )}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>

          {/* In-App Confirmation Modal for Deletion (No window.confirm!) */}
          <AnimatePresence>
            {confirmDeleteTarget && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 max-w-sm w-full space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <h4 className="font-bold text-gray-900 text-sm">
                        {confirmDeleteTarget.type === "single"
                          ? "일지 기록 삭제"
                          : confirmDeleteTarget.type === "selected"
                          ? `선택한 ${confirmDeleteTarget.count}건 삭제`
                          : "보관함 전체 삭제"}
                      </h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {confirmDeleteTarget.type === "single" ? (
                          <>
                            <strong>{confirmDeleteTarget.name}</strong> 일지 기록을 정말 삭제하시겠습니까?
                          </>
                        ) : confirmDeleteTarget.type === "selected" ? (
                          <>
                            선택된 <strong>{confirmDeleteTarget.count}개</strong>의 일지 기록을 클라우드에서 완전히 삭제하시겠습니까?
                          </>
                        ) : (
                          <>
                            클라우드 보관함에 저장된 <strong>모든 일지 기록({confirmDeleteTarget.count}건)</strong>을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmDeleteTarget(null)}
                      className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleExecuteDelete}
                      className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                    >
                      {isDeleting ? (
                        <>삭제 진행 중...</>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>삭제 확인</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
