import React, { useState } from "react";
import { 
  X, 
  Trash2, 
  Copy, 
  Check, 
  Calendar, 
  User, 
  FileText, 
  Search, 
  Database, 
  Clock,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SavedLogItem, deleteLogFromFirestore } from "../lib/firebase";

interface CloudLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SavedLogItem[];
  onSelectLog?: (log: SavedLogItem) => void;
}

export const CloudLogsModal: React.FC<CloudLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  onSelectLog
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<"ALL" | "생활일지" | "프로그램일지">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 일지 기록을 삭제하시겠습니까?")) return;
    setDeletingId(id);
    await deleteLogFromFirestore(id);
    setDeletingId(null);
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Modal Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  Firebase 클라우드 일지 보관함
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                    실시간 동기화됨
                  </span>
                </h3>
                <p className="text-xs text-gray-500">
                  생성된 모든 일지가 Firebase 클라우드에 안전하게 영구 보관됩니다. (총 {logs.length}건)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row gap-3">
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
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
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

          {/* Logs List Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-gray-50/30">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-gray-400" />
                <p className="text-sm font-semibold text-gray-600">저장된 일지 기록이 없습니다.</p>
                <p className="text-xs text-gray-400 mt-1">
                  일지를 생성하면 자동으로 Firebase 클라우드에 안전하게 보관됩니다.
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const logId = log.id || Math.random().toString();
                const isLiving = log.type === "생활일지";
                const isCopied = copiedId === logId;
                const isDeleting = deletingId === logId;

                return (
                  <motion.div
                    key={logId}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-xs hover:border-gray-300 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2 flex-wrap">
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
                          <User className="w-3 h-3 text-gray-400" />
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
                          disabled={isDeleting}
                          onClick={() => handleDelete(logId)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="기록 삭제"
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

          {/* Modal Footer */}
          <div className="p-3.5 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Firebase Firestore DB에 저장 및 안전한 백업 유지
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors"
            >
              닫기
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
