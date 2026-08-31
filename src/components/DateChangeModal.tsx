import React from "react";
import { Calendar, Trash2, User, RefreshCw, X } from "lucide-react";
import { motion } from "motion/react";

interface DateChangeModalProps {
  currentDate: string;
  newDate: string;
  hasContent: boolean;
  onConfirm: (action: "clear_all" | "keep_names" | "keep_all") => void;
  onCancel: () => void;
}

export const DateChangeModal: React.FC<DateChangeModalProps> = ({
  currentDate,
  newDate,
  hasContent,
  onConfirm,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 sm:p-6 border border-gray-100 overflow-hidden"
      >
        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">
                일지 작성 날짜 변경
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                작성 날짜를 <span className="font-semibold text-gray-700">{currentDate}</span>에서 <span className="font-bold text-blue-600">{newDate}</span>(으)로 변경합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          <p className="text-xs text-gray-600 font-medium leading-relaxed">
            기존에 입력해 둔 내용이 있습니다. 날짜를 변경하면서 내용을 어떻게 처리할까요?
          </p>

          {/* Option 1: Keep only names */}
          <button
            type="button"
            onClick={() => onConfirm("keep_names")}
            className="w-full text-left p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 transition-all flex items-start gap-3 group"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-blue-900">이용인 이름만 유지하고 내용 비우기</span>
                <span className="text-[10px] bg-blue-200/80 text-blue-800 font-bold px-1.5 py-0.2 rounded-full">추천</span>
              </div>
              <p className="text-[11px] text-blue-700/80 mt-0.5">
                반 이용인 명단(이름)은 그대로 두고 세부 작성 내용(식생활, 송영 등)만 깔끔하게 초기화합니다.
              </p>
            </div>
          </button>

          {/* Option 2: Clear all */}
          <button
            type="button"
            onClick={() => onConfirm("clear_all")}
            className="w-full text-left p-3.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100/60 transition-all flex items-start gap-3 group"
          >
            <div className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-extrabold text-red-900">전부 삭제 (새로 작성)</span>
              <p className="text-[11px] text-red-700/80 mt-0.5">
                이름을 포함한 모든 입력 내용과 생성 결과를 완전히 초기화합니다.
              </p>
            </div>
          </button>

          {/* Option 3: Keep all (Just change date) */}
          <button
            type="button"
            onClick={() => onConfirm("keep_all")}
            className="w-full text-left p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-gray-100 transition-all flex items-start gap-3 group"
          >
            <div className="w-7 h-7 rounded-lg bg-gray-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-extrabold text-gray-800">삭제 안 하고 날짜만 변경</span>
              <p className="text-[11px] text-gray-500 mt-0.5">
                현재 입력된 이름과 모든 기록 내용을 그대로 유지한 채 날짜만 바꿉니다.
              </p>
            </div>
          </button>
        </div>

        <div className="pt-2 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            변경 취소
          </button>
        </div>
      </motion.div>
    </div>
  );
};
