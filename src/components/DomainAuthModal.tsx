import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Globe, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Sparkles 
} from "lucide-react";

interface DomainAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

export const DomainAuthModal: React.FC<DomainAuthModalProps> = ({
  isOpen,
  onClose,
  projectId = "carelog-dfd39",
}) => {
  const [copiedDev, setCopiedDev] = useState(false);
  const [copiedPre, setCopiedPre] = useState(false);

  if (!isOpen) return null;

  const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
  const devDomain = currentHost || "ais-dev-ghfa2cdwbk3myq6lvrrnjs-316581972876.asia-northeast1.run.app";
  const preDomain = "ais-pre-ghfa2cdwbk3myq6lvrrnjs-316581972876.asia-northeast1.run.app";

  const consoleSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const copyToClipboard = async (text: string, isDev: boolean) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      if (isDev) {
        setCopiedDev(true);
        setTimeout(() => setCopiedDev(false), 2500);
      } else {
        setCopiedPre(true);
        setTimeout(() => setCopiedPre(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="domain-auth-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          id="domain-auth-modal-dialog"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-amber-50/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-snug">
                  Google 로그인 승인 도메인 등록 안내
                </h3>
                <p className="text-xs text-amber-800/80 font-medium">
                  Firebase 보안 정책 (auth/unauthorized-domain)
                </p>
              </div>
            </div>
            <button
              id="domain-auth-close-btn"
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
            <p className="text-gray-600">
              Firebase Authentication은 승인되지 않은 외부 도메인에서의 로그인을 차단합니다. 
              클라우드 실시간 동기화를 사용하시려면 아래 도메인을 Firebase 콘솔의 <strong>[승인된 도메인]</strong>에 등록해 주세요.
            </p>

            {/* Domains list to copy */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-800">
                등록할 앱 도메인 (클릭하여 복사):
              </label>

              {/* Dev Domain */}
              <div className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-mono text-xs text-gray-800 truncate select-all">
                    {devDomain}
                  </span>
                </div>
                <button
                  id="domain-auth-copy-dev-btn"
                  type="button"
                  onClick={() => copyToClipboard(devDomain, true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                    copiedDev
                      ? "bg-emerald-600 text-white"
                      : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-2xs active:scale-95"
                  }`}
                >
                  {copiedDev ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>복사됨!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>복사</span>
                    </>
                  )}
                </button>
              </div>

              {/* Pre/Shared Domain if different */}
              {devDomain !== preDomain && (
                <div className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Globe className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-mono text-xs text-gray-800 truncate select-all">
                      {preDomain}
                    </span>
                  </div>
                  <button
                    id="domain-auth-copy-pre-btn"
                    type="button"
                    onClick={() => copyToClipboard(preDomain, false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                      copiedPre
                        ? "bg-emerald-600 text-white"
                        : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-2xs active:scale-95"
                    }`}
                  >
                    {copiedPre ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>복사됨!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Step-by-Step Guide */}
            <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/80 space-y-2">
              <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>등록 방법 (1분 소요):</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-600 pl-1">
                <li>
                  아래 <strong>[Firebase 콘솔 설정 열기]</strong> 버튼을 누릅니다.
                </li>
                <li>
                  <strong>[Authentication]</strong> &gt; <strong>[설정]</strong> 탭의 <strong>[승인된 도메인]</strong> 섹션으로 스크롤합니다.
                </li>
                <li>
                  <strong>[도메인 추가]</strong>를 누른 후 위에서 복사한 도메인을 입력하고 저장합니다.
                </li>
                <li>앱 화면으로 돌아와 다시 <strong>[Google 로그인]</strong>을 클릭하면 즉시 연동됩니다.</li>
              </ol>
            </div>

            {/* Direct Link to Firebase Console */}
            <a
              id="domain-auth-open-console-link"
              href={consoleSettingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer text-center text-xs sm:text-sm"
            >
              <span>Firebase 콘솔 설정 열기 (새 탭)</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Reassurance Note */}
            <div className="p-3 bg-emerald-50/80 border border-emerald-200/70 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>안심하고 계속 사용하실 수 있습니다:</strong>
                <p className="mt-0.5 text-emerald-800">
                  Google 로그인 전이라도 생활일지/프로그램일지 작성, Gemini AI 자동 생성, 6인 일괄 작성, 로컬 자동 백업은 모두 100% 정상 작동합니다.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              id="domain-auth-confirm-btn"
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer"
            >
              확인 (로컬 모드로 계속 사용)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
