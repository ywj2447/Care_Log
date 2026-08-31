import React from "react";
import { 
  Bus, 
  Car,
  Footprints,
  Sparkles, 
  Droplets, 
  Utensils, 
  UtensilsCrossed,
  Apple, 
  HeartPulse, 
  Activity, 
  Smile, 
  Users, 
  AlertTriangle, 
  Palette, 
  BookOpen, 
  Eye, 
  HandHelping, 
  Trophy, 
  CalendarCheck, 
  Pill, 
  Thermometer, 
  Shirt, 
  MapPin, 
  Target, 
  ShieldCheck, 
  Clock, 
  Plus, 
  X, 
  Tag, 
  CheckCircle2,
  Brain,
  Bandage,
  DoorOpen,
  Briefcase,
  Volume2,
  Frown,
  Timer,
  Copy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { KeywordGroup } from "../constants/careKeywords";

interface CategoryHeaderProps {
  label: string;
  categoryKey: string;
  groups: KeywordGroup[];
  isOpen: boolean;
  onToggle: () => void;
  onSelectKeyword: (keyword: string) => void;
  badgeColor?: "blue" | "purple";
  onCopyAll?: () => void;
}

// 카테고리 대표 아이콘
const getCategoryIcon = (categoryKey: string, isBlue: boolean) => {
  const key = categoryKey.toLowerCase();
  const cls = `w-3.5 h-3.5 ${isBlue ? "text-blue-600" : "text-purple-600"}`;

  if (key.includes("transit")) return <Bus className={cls} />;
  if (key.includes("hygiene")) return <Droplets className={cls} />;
  if (key.includes("diet")) return <Utensils className={cls} />;
  if (key.includes("health")) return <HeartPulse className={cls} />;
  if (key.includes("others")) return <Smile className={cls} />;
  if (key.includes("progname") || key.includes("program")) return <Palette className={cls} />;
  if (key.includes("observation")) return <Eye className={cls} />;
  if (key.includes("support")) return <HandHelping className={cls} />;
  if (key.includes("reaction")) return <Trophy className={cls} />;
  if (key.includes("plan")) return <CalendarCheck className={cls} />;

  return <Tag className={cls} />;
};

// 소그룹별 아이콘
const getGroupIcon = (groupName: string, isBlue: boolean) => {
  const cls = `w-3 h-3 ${isBlue ? "text-blue-500" : "text-purple-500"}`;

  // 생활일지 소그룹
  if (groupName.includes("등원")) return <Bus className={cls} />;
  if (groupName.includes("귀가") || groupName.includes("하원")) return <Car className={cls} />;
  if (groupName.includes("차량") || groupName.includes("이동")) return <Footprints className={cls} />;

  if (groupName.includes("손씻기") || groupName.includes("세면") || groupName.includes("위생")) return <Droplets className={cls} />;
  if (groupName.includes("양치") || groupName.includes("구강") || groupName.includes("환의") || groupName.includes("의복")) return <Shirt className={cls} />;
  if (groupName.includes("배변") || groupName.includes("화장실")) return <DoorOpen className={cls} />;

  if (groupName.includes("식사") || groupName.includes("섭취")) return <Utensils className={cls} />;
  if (groupName.includes("식습관") || groupName.includes("선호")) return <UtensilsCrossed className={cls} />;
  if (groupName.includes("간식") || groupName.includes("수분")) return <Apple className={cls} />;

  if (groupName.includes("체온") || groupName.includes("바이탈")) return <Thermometer className={cls} />;
  if (groupName.includes("투약")) return <Pill className={cls} />;
  if (groupName.includes("상처") || groupName.includes("증상")) return <Bandage className={cls} />;

  if (groupName.includes("정서") || groupName.includes("기분")) return <Smile className={cls} />;
  if (groupName.includes("대인") || groupName.includes("소통") || groupName.includes("교사")) return <Users className={cls} />;
  if (groupName.includes("행동") || groupName.includes("위기")) return <AlertTriangle className={cls} />;

  // 프로그램일지 소그룹
  if (groupName.includes("인지") || groupName.includes("학습")) return <Brain className={cls} />;
  if (groupName.includes("신체") || groupName.includes("체육")) return <Activity className={cls} />;
  if (groupName.includes("예술") || groupName.includes("음악") || groupName.includes("미술")) return <Palette className={cls} />;
  if (groupName.includes("사회성") || groupName.includes("소통")) return <Users className={cls} />;
  if (groupName.includes("직업") || groupName.includes("일상")) return <Briefcase className={cls} />;

  if (groupName.includes("참여") || groupName.includes("동기")) return <Sparkles className={cls} />;
  if (groupName.includes("수행") || groupName.includes("숙련")) return <Trophy className={cls} />;
  if (groupName.includes("상호작용")) return <Users className={cls} />;

  if (groupName.includes("신체적") || groupName.includes("손길")) return <HandHelping className={cls} />;
  if (groupName.includes("언어적") || groupName.includes("시각적")) return <Volume2 className={cls} />;
  if (groupName.includes("환경") || groupName.includes("도구")) return <ShieldCheck className={cls} />;

  if (groupName.includes("긍정") || groupName.includes("흥미")) return <Smile className={cls} />;
  if (groupName.includes("소극") || groupName.includes("어려움")) return <Frown className={cls} />;
  if (groupName.includes("성취") || groupName.includes("결과")) return <CheckCircle2 className={cls} />;

  if (groupName.includes("난이도") || groupName.includes("조정")) return <Target className={cls} />;
  if (groupName.includes("보완") || groupName.includes("강화")) return <Plus className={cls} />;
  if (groupName.includes("연계") || groupName.includes("후속")) return <CalendarCheck className={cls} />;

  return <Tag className={cls} />;
};

// 키워드별 아이콘
const getKeywordItemIcon = (keyword: string) => {
  const cls = "w-3 h-3 text-gray-400 group-hover:text-blue-600 transition-colors shrink-0";

  if (keyword.includes("등원") || keyword.includes("도착")) return <Bus className={cls} />;
  if (keyword.includes("귀가") || keyword.includes("하원")) return <Car className={cls} />;
  if (keyword.includes("손씻기") || keyword.includes("양치") || keyword.includes("세수")) return <Droplets className={cls} />;
  if (keyword.includes("식사") || keyword.includes("섭취") || keyword.includes("밥") || keyword.includes("반찬")) return <Utensils className={cls} />;
  if (keyword.includes("체온") || keyword.includes("36.")) return <Thermometer className={cls} />;
  if (keyword.includes("투약") || keyword.includes("약")) return <Pill className={cls} />;
  if (keyword.includes("미소") || keyword.includes("안정") || keyword.includes("밝은")) return <Smile className={cls} />;
  if (keyword.includes("도움") || keyword.includes("보조")) return <HandHelping className={cls} />;
  if (keyword.includes("동료") || keyword.includes("친구")) return <Users className={cls} />;
  if (keyword.includes("주의") || keyword.includes("위기") || keyword.includes("중재") || keyword.includes("거부")) return <AlertTriangle className={cls} />;
  if (keyword.includes("성공") || keyword.includes("완성") || keyword.includes("성취")) return <Trophy className={cls} />;
  if (keyword.includes("지원") || keyword.includes("보조") || keyword.includes("도움")) return <HandHelping className={cls} />;
  if (keyword.includes("계획") || keyword.includes("목표")) return <CalendarCheck className={cls} />;

  return <Plus className={cls} />;
};

export const CategoryHeaderWithKeywords: React.FC<CategoryHeaderProps> = ({
  label,
  categoryKey,
  groups,
  isOpen,
  onToggle,
  onSelectKeyword,
  badgeColor = "blue",
  onCopyAll
}) => {
  const isBlue = badgeColor === "blue";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-nowrap">
        <button
          type="button"
          onClick={onToggle}
          className={`group flex items-center gap-1.5 text-xs font-bold transition-all text-left py-1 px-2.5 rounded-lg border whitespace-nowrap shrink-0 ${
            isOpen
              ? isBlue
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-purple-600 text-white border-purple-600 shadow-xs"
              : isBlue
                ? "text-blue-700 bg-blue-50/70 border-blue-200/80 hover:bg-blue-100/80 hover:text-blue-800"
                : "text-purple-700 bg-purple-50/70 border-purple-200/80 hover:bg-purple-100/80 hover:text-purple-800"
          }`}
          title="클릭하여 키워드를 열고 닫습니다"
        >
          <span className="flex items-center gap-1.5">
            {getCategoryIcon(categoryKey, isBlue && !isOpen)}
            <span className="font-extrabold tracking-tight">{label}</span>
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
            isOpen 
              ? "bg-white/20 text-white" 
              : isBlue ? "bg-blue-200/60 text-blue-800" : "bg-purple-200/60 text-purple-800"
          }`}>
            {isOpen ? "접기 ▲" : "키워드 ▼"}
          </span>
        </button>

        {onCopyAll && (
          <button
            type="button"
            onClick={onCopyAll}
            className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-blue-700 bg-gray-50 hover:bg-blue-50/80 border border-gray-200 hover:border-blue-200 py-1 px-2.5 rounded-lg transition-all shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
            title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
          >
            <Copy className="w-3 h-3 text-gray-400 group-hover:text-blue-500 shrink-0" />
            <span>일괄 적용</span>
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`p-3 rounded-2xl border shadow-sm ${
              isBlue 
                ? "bg-gradient-to-b from-blue-50/90 via-indigo-50/40 to-white border-blue-200" 
                : "bg-gradient-to-b from-purple-50/90 via-pink-50/40 to-white border-purple-200"
            }`}
          >
            {/* Header info bar */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200/70">
              <div className="flex items-center gap-1.5">
                {getCategoryIcon(categoryKey, isBlue)}
                <span className={`text-[11px] font-bold ${isBlue ? "text-blue-900" : "text-purple-900"}`}>
                  {label} 맞춤 키워드
                </span>
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded-md hover:bg-gray-100 transition-colors"
                title="키워드 닫기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Keyword Groups */}
            <div className="space-y-3">
              {groups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  {/* Group Title with Icon */}
                  <div className="flex items-center gap-1.5 px-1">
                    {getGroupIcon(group.groupName, isBlue)}
                    <span className={`text-[11px] font-bold ${
                      isBlue ? "text-blue-800" : "text-purple-800"
                    }`}>
                      {group.groupName}
                    </span>
                  </div>

                  {/* Buttons with contextual keyword icon */}
                  <div className="flex flex-wrap gap-1.5">
                    {group.keywords.map((keyword, kIdx) => (
                      <button
                        key={kIdx}
                        type="button"
                        onClick={() => onSelectKeyword(keyword)}
                        className={`group text-left px-2.5 py-1 text-xs rounded-xl border bg-white shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 active:scale-95 ${
                          isBlue
                            ? "border-blue-100 hover:border-blue-400 hover:bg-blue-50 text-gray-700 hover:text-blue-900"
                            : "border-purple-100 hover:border-purple-400 hover:bg-purple-50 text-gray-700 hover:text-purple-900"
                        }`}
                        title="클릭하여 내용에 추가"
                      >
                        {getKeywordItemIcon(keyword)}
                        <span className="leading-tight">{keyword}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 키워드 목록이 없는 일반 카테고리 헤더 (프로그램 등) 통일 컴포넌트
interface SimpleCategoryHeaderProps {
  label: string;
  badgeText?: string;
  icon?: React.ReactNode;
  badgeColor?: "blue" | "purple";
  onCopyAll?: () => void;
}

export const SimpleCategoryHeader: React.FC<SimpleCategoryHeaderProps> = ({
  label,
  badgeText = "직접 입력",
  icon,
  badgeColor = "blue",
  onCopyAll,
}) => {
  const isBlue = badgeColor === "blue";

  return (
    <div className="flex items-center justify-between gap-2 flex-nowrap">
      <div
        className={`flex items-center gap-1.5 text-xs font-bold py-1 px-2.5 rounded-lg border select-none whitespace-nowrap shrink-0 ${
          isBlue
            ? "text-blue-700 bg-blue-50/70 border-blue-200/80"
            : "text-purple-700 bg-purple-50/70 border-purple-200/80"
        }`}
      >
        <span className="flex items-center gap-1.5">
          {icon || <Palette className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
          <span className="font-extrabold tracking-tight">{label}</span>
        </span>
        {badgeText && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
              isBlue
                ? "bg-blue-200/60 text-blue-800"
                : "bg-purple-200/60 text-purple-800"
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {onCopyAll && (
        <button
          type="button"
          onClick={onCopyAll}
          className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-blue-700 bg-gray-50 hover:bg-blue-50/80 border border-gray-200 hover:border-blue-200 py-1 px-2.5 rounded-lg transition-all shadow-2xs active:scale-95 whitespace-nowrap shrink-0"
          title="현재 입력한 내용을 모든 이용인에게 동일하게 복사합니다."
        >
          <Copy className="w-3 h-3 text-gray-400 group-hover:text-blue-500 shrink-0" />
          <span>일괄 적용</span>
        </button>
      )}
    </div>
  );
};
