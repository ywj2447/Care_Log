import React, { useState } from "react";
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  X, 
  Check, 
  UserCheck, 
  Sparkles, 
  MessageSquare, 
  AlertTriangle, 
  HelpCircle,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ManagedClient, saveManagedClientToFirestore, deleteManagedClientFromFirestore } from "../lib/firebase";

interface ManagedClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: ManagedClient[];
  onSelectClient?: (client: ManagedClient) => void;
  onSelectMultipleClients?: (selectedClients: ManagedClient[]) => void;
  selectionMode?: "none" | "single" | "multiple";
  isLoggedIn: boolean;
  onOpenLogin: () => void;
}

export const ManagedClientsModal: React.FC<ManagedClientsModalProps> = ({
  isOpen,
  onClose,
  clients,
  onSelectClient,
  onSelectMultipleClients,
  selectionMode = "none",
  isLoggedIn,
  onOpenLogin
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"남" | "여" | "">("");
  const [birth, setBirth] = useState("");
  const [personality, setPersonality] = useState("");
  const [communication, setCommunication] = useState("");
  const [behaviorTraits, setBehaviorTraits] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Multiple selection for batch mode insertion
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.personality && c.personality.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.behaviorTraits && c.behaviorTraits.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const resetForm = () => {
    setName("");
    setGender("");
    setBirth("");
    setPersonality("");
    setCommunication("");
    setBehaviorTraits("");
    setNotes("");
    setFormError("");
    setEditingId(null);
    setIsEditing(false);
  };

  const handleStartAdd = () => {
    if (clients.length >= 30) {
      alert("담당 이용인은 최대 30명까지 등록할 수 있습니다.");
      return;
    }
    resetForm();
    setIsEditing(true);
  };

  const handleStartEdit = (client: ManagedClient) => {
    setEditingId(client.id);
    setName(client.name);
    setGender(client.gender || "");
    setBirth(client.birth || "");
    setPersonality(client.personality || "");
    setCommunication(client.communication || "");
    setBehaviorTraits(client.behaviorTraits || "");
    setNotes(client.notes || "");
    setFormError("");
    setIsEditing(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("이용인 성함은 필수 입력 항목입니다.");
      return;
    }

    if (!isLoggedIn) {
      setFormError("이용인 정보를 클라우드에 영구 저장하려면 Google 로그인이 필요합니다.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    const clientToSave: ManagedClient = {
      id: editingId || `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      gender,
      birth: birth.trim(),
      personality: personality.trim(),
      communication: communication.trim(),
      behaviorTraits: behaviorTraits.trim(),
      notes: notes.trim(),
    };

    try {
      await saveManagedClientToFirestore(clientToSave);
      resetForm();
    } catch (err: any) {
      setFormError("저장 중 오류가 발생했습니다: " + (err?.message || "다시 시도해 주세요."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (clientId: string, clientName: string) => {
    if (!confirm(`'${clientName}' 이용인 정보를 정말 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await deleteManagedClientFromFirestore(clientId);
      if (editingId === clientId) {
        resetForm();
      }
    } catch (err: any) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : (prev.length < 6 ? [...prev, id] : prev)
    );
  };

  const handleApplySelectedBatch = () => {
    if (!onSelectMultipleClients) return;
    const chosen = clients.filter(c => selectedIds.includes(c.id));
    onSelectMultipleClients(chosen);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-gray-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900 leading-tight">담당 이용인 관리</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {clients.length} / 30명 등록됨
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                등록된 특징(성향, 소통방식, 주의사항)은 일지 생성 시 AI가 안전하게 참고합니다.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Not logged in warning banner */}
        {!isLoggedIn && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center justify-between gap-3 text-amber-800 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                로그인하지 않으면 담당 이용인 데이터가 동기화되지 않습니다.
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-bold hover:bg-amber-700 transition-colors whitespace-nowrap shadow-2xs"
            >
              Google 로그인하기
            </button>
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col lg:flex-row gap-5">
          {/* Left panel: List & Search */}
          <div className={`flex flex-col gap-3 ${isEditing ? "lg:w-1/2" : "w-full"}`}>
            {/* Action Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="이름, 성향, 키워드 검색..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
                />
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  disabled={clients.length >= 30}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-2xs transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>새 이용인 등록</span>
                </button>
              )}
            </div>

            {/* Batch mode multi-selection banner */}
            {selectionMode === "multiple" && clients.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-1.5 font-medium">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>일괄 작성 슬롯에 적용할 이용인 선택 ({selectedIds.length}/6명)</span>
                </div>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApplySelectedBatch}
                    className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-2xs text-xs"
                  >
                    선택한 {selectedIds.length}명 일괄 적용
                  </button>
                )}
              </div>
            )}

            {/* Clients List */}
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {clients.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                  <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-bold text-gray-700">등록된 담당 이용인이 없습니다</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                    최대 30명까지 담당 이용인의 이름과 평소 특성(성향, 소통방식 등)을 등록해두면 클릭 한 번으로 선택하고 AI가 안전하게 참고합니다.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartAdd}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-2xs"
                  >
                    첫 이용인 등록하기
                  </button>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  검색 결과와 일치하는 이용인이 없습니다.
                </div>
              ) : (
                filteredClients.map((client) => {
                  const isChecked = selectedIds.includes(client.id);
                  return (
                    <div 
                      key={client.id}
                      className={`p-3.5 rounded-xl border transition-all duration-150 ${
                        editingId === client.id 
                          ? "border-blue-500 bg-blue-50/40 shadow-xs" 
                          : isChecked
                            ? "border-blue-400 bg-blue-50/20"
                            : "border-gray-200/90 bg-white hover:border-gray-300 hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          {selectionMode === "multiple" && (
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectId(client.id)}
                              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-gray-900">{client.name}</h4>
                              {client.gender && (
                                <span className="text-[11px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600">
                                  {client.gender}
                                </span>
                              )}
                              {client.birth && (
                                <span className="text-[11px] text-gray-400">
                                  ({client.birth})
                                </span>
                              )}
                            </div>

                            {/* Traits summary */}
                            <div className="mt-1.5 space-y-1 text-xs">
                              {client.personality && (
                                <div className="flex items-center gap-1.5 text-gray-700">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span className="font-semibold text-gray-500 text-[11px] shrink-0">성향:</span>
                                  <span className="truncate">{client.personality}</span>
                                </div>
                              )}
                              {client.communication && (
                                <div className="flex items-center gap-1.5 text-gray-700">
                                  <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                  <span className="font-semibold text-gray-500 text-[11px] shrink-0">소통:</span>
                                  <span className="truncate">{client.communication}</span>
                                </div>
                              )}
                              {client.behaviorTraits && (
                                <div className="flex items-center gap-1.5 text-gray-700">
                                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                  <span className="font-semibold text-gray-500 text-[11px] shrink-0">주의/특성:</span>
                                  <span className="truncate">{client.behaviorTraits}</span>
                                </div>
                              )}
                              {client.notes && (
                                <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                                  <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span className="truncate">{client.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {selectionMode === "single" && onSelectClient && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectClient(client);
                                onClose();
                              }}
                              className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
                            >
                              선택
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(client)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="수정"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(client.id, client.name)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Add/Edit Form */}
          {isEditing && (
            <div className="lg:w-1/2 bg-slate-50/70 p-4 rounded-2xl border border-gray-200 flex flex-col justify-between">
              <form onSubmit={handleSaveForm} className="space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>{editingId ? "이용인 정보 및 특징 수정" : "새 담당 이용인 등록"}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-gray-400 hover:text-gray-600 p-1"
                  >
                    닫기
                  </button>
                </div>

                {formError && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Name & Gender & Birth */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      성함 <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      성별
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    >
                      <option value="">선택 안 함</option>
                      <option value="남">남성</option>
                      <option value="여">여성</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      생년월일/연령
                    </label>
                    <input 
                      type="text" 
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                      placeholder="예: 95.04.12 또는 20대"
                      className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>

                {/* Personality & Preferences */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>성향 및 기분 / 선호 활동</span>
                  </label>
                  <input 
                    type="text" 
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    placeholder="예: 밝고 활발함, 클래식 음악을 들을 때 안정됨, 차분한 활동 선호"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  />
                </div>

                {/* Communication */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                    <span>의사소통 방식</span>
                  </label>
                  <input 
                    type="text" 
                    value={communication}
                    onChange={(e) => setCommunication(e.target.value)}
                    placeholder="예: 구어 소통 원활 / 단어 카드로 의사표현 / 간단한 단어 및 손짓 사용"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  />
                </div>

                {/* Behavior Traits & Warnings */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    <span>행동 특성 및 지원 시 주의사항</span>
                  </label>
                  <textarea 
                    value={behaviorTraits}
                    onChange={(e) => setBehaviorTraits(e.target.value)}
                    rows={2}
                    placeholder="예: 갑작스러운 큰 소음에 민감하여 귀를 막을 수 있음, 일정 전환 시 사전 언어적 안내 필요 등"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white resize-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    * AI는 이 내용을 지원 어조나 환경 참고용으로만 활용하며, 발생하지 않은 허위 행동을 지어내지 않습니다.
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    기타 참고 메모
                  </label>
                  <input 
                    type="text" 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="예: 특정 반찬 선호, 식사 시 보조도구 사용 등"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  />
                </div>

                {/* Submit buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3.5 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-semibold hover:bg-gray-100 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 active:bg-blue-800 transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? "저장 중..." : "저장 완료"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              선택한 이용인의 특징은 일지 작성 시 AI가 개별 특성에 맞춰 배경 맥락으로 안전하게 반영합니다.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-2xs"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
};
