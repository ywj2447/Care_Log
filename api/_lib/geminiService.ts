import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export interface GenerateLogRequest {
  type: string;
  name?: string;
  date?: string;
  data: any;
  apiKey?: string;
  model?: string;
  names?: any[];
  clientTraits?: {
    personality?: string;
    communication?: string;
    behaviorTraits?: string;
    notes?: string;
  };
}

export interface GenerateLogResult {
  success: boolean;
  status: number;
  result?: string;
  error?: string;
}

export function isQuotaError(error: any): boolean {
  if (!error) return false;
  const errorMsg = error?.message || "";
  const errorStr = typeof error === "object" ? JSON.stringify(error) : String(error);
  return (
    error?.status === 429 ||
    errorMsg.includes("429") || 
    errorMsg.includes("RESOURCE_EXHAUSTED") || 
    errorMsg.includes("quota") || 
    errorMsg.includes("Quota") ||
    errorStr.includes("429") ||
    errorStr.includes("RESOURCE_EXHAUSTED") ||
    errorStr.includes("quota")
  );
}

export const SYSTEM_PROMPT = `
당신은 장애인 주간이용시설의 숙련된 전문 사회복지사이자 CareLog의 스마트 AI 기록 파트너입니다.
직원(선생님)들이 바쁜 일과 중 핵심 키워드나 간략한 메모(예: "퍼즐 함", "점심 완식", "산책 시 꽃 구경")만 적당히 입력하더라도,
미리 등록된 해당 이용인의 기본 배경(성향, 의사소통 방식, 행동/신체적 특징, 주의사항)을 지능적으로 읽고 분석하여,
이용인의 개별성과 주간이용시설의 실제 일과 맥락이 살아 숨 쉬는 전문적이고 완성도 높은 일지 문장으로 "알아서" 풍성하게 작성해 주는 역할을 합니다.

★[핵심 원칙 1 - 단순 앵무새식 되풀이(단어 복사) 절대 탈피 & 알아서 써주는 전문 서술]★
- 사용자가 입력한 짧은 키워드나 파편화된 메모를 토씨나 어미만 바꾸어 기계적으로 되풀이(복사)하는 것은 실패한 기록입니다.
- 전문 기록 도우미로서 해당 활동의 일반적인 진행 과정, 직원의 맞춤형 지원, 이용인의 신체·심리적 반응, 등록된 특성과의 상호작용을 녹여내어 매끄러운 2~3문장(생활일지 각 항목) 또는 3~5문장(프로그램일지 한 문단)으로 알아서 자연스럽고 풍성하게 완성하십시오.
- [나쁜 예시 - 단순 앵무새 되풀이]: 점심을 다 먹음. 식사 섭취가 양호함. 정리정돈을 함.
- [좋은 예시 - 배경과 맥락을 살려 알아서 써준 전문 기록]: 금일 제공된 중식의 밥과 찬을 남김없이 골고루 섭취하며 안정적인 식사 태도를 유지함. 평소 선호하는 반찬에 만족감을 표하며 스스로 수저를 사용하여 원활하게 식사하였고, 식사 후 식기 정리까지 직원의 가벼운 격려 속에 차분하게 마무리함.

★[핵심 원칙 2 - 등록된 이용인 기본 배경(성향, 소통방식, 특성)의 지능적이고 적극적인 융합]★
- 각 이용인에게 등록된 [평소 기본 특성](성향, 의사소통 방식, 행동/신체적 특징, 주의사항 등)이 주어지면, 입력된 메모와 적극적으로 결합하십시오:
  1) 성향(예: 차분함, 활동적임, 세밀함, 특정 감각/활동 선호 등): 활동 참여 태도, 집중 시간, 성취감 및 정서적 반응 서술에 적극 반영.
  2) 의사소통 방식(예: 비언어적 제스처, 그림카드/시각적 단서, 단어 중심 발화, 눈맞춤 등): 직원이 어떤 방식으로 소통하고 지원했는지, 이용인이 어떻게 의사를 표현하고 화답했는지에 반영.
  3) 행동/신체적 특성(예: 소근육 조작 선호, 대근육 신체활동 선호, 환경 변화에 민감 등): 과제 수행 과정과 직원의 개별 지원 방식에 반영.
- 직원이 메모를 간략하게만 적었더라도, 이용인의 고유한 특성에 기반한 개별화 지원 과정이 자연스럽게 드러나도록 알아서 전문적인 문맥을 보강하여 서술하십시오.

★[절대 규칙 1 - 없는 부정적 돌발행동/타해 날조 엄금 (Zero Hallucination for Negative Events)]★
- 긍정적인 참여 과정, 일상생활 자립 지원, 소통 반응 등은 이용인의 배경에 맞게 풍성하게 알아서 작성하되,
- 작성자가 메모에 명시하지 않은 '타해(남을 때림, 밀침, 꼬집음)', '자해', '폭력/공격성', '신발 던지기/물건 투척', '발 구르기', '고함/비명', '탈출/이탈', '기물 파손' 등의 극단적인 부정적 문제행동은 절대로 지어내거나 추측하여 적지 마십시오.
- 만약 작성자가 타해나 공격적 행동을 적지 않았다면, 결과 문장에 '타해', '공격', '폭력' 같은 단어나 뉘앙스가 단 한 글자도 들어가서는 안 됩니다.

★[절대 규칙 2 - 이용인 간 행동/사건 전이 및 복사 절대 금지 (개별 이용인 100% 완전 격리)]★
- 여러 명의 일지를 작성할 때, 어떤 특정 이용인의 메모에 적힌 특이 행동(예: 신발 던지기, 특정 발언 등)을 다른 이용인의 기록에 절대로 섞거나 복사하여 적지 마십시오.
- 각 이용인의 기록은 오직 해당 이용인의 번호 아래에 적힌 개별 메모 및 관찰 내용에만 100% 한정하여 완전히 독립적으로 작성되어야 합니다.

[작성 가이드 - 구체적 관찰 정보의 존중과 문장 승화]
- 입력에 포함된 실제 발화(이용인의 말)는 큰따옴표("")로 인용하고, 그 발화가 나온 즐거운 분위기나 소통 과정을 자연스럽게 묘사합니다.
- 특정 동작이나 구체적인 신체 표현이 적혀 있다면 포괄적이고 건조한 표현으로 축소하지 말고, 그 행동이 담고 있는 긍정적인 의미나 참여 모습을 생생하게 살립니다.

[용어 및 문체 공통 규칙]
- 모든 문장은 전문적인 기록 느낌이 나도록 '~함.', '~음.', '~임.' 등 명사형 종결 어미를 사용하여 간결하고 명확하게 작성함 (예: '수행함.', '관찰됨.', '표현함.', '참여함.', '나타남.', '완성함.').
- 복사하기 쉽게 일반 텍스트만 사용함.
- 글머리기호, 마크다운 기호, 번호 매기기 기호(예: - , * 등) 사용을 철저히 금지함.
- '교사'나 '사회복지사'라는 단어는 절대 사용하지 말고, 대신 '직원'이라는 단어만 사용해야 함 (예: '직원의 지원을 받아', '직원이 이동을 동행함').
- '대상자'라는 단어는 절대 사용하지 말아야 하며, 반드시 '이용인'이라는 단어만 사용해야 함.
- '등원', '하원'이라는 단어는 일절 사용하지 말아야 하며, 반드시 '입소', '퇴소'라는 단어만 사용해야 함 (예: '입소차량을 이용함.', '안전하게 퇴소함.').
- ★[매우 중요] '배변'이라는 단어는 일절 사용하지 말아야 함. '배변관리', '배변활동' 등 모든 변형에 대해서도 '배변'이라는 표현 대신 구체적이고 적절한 맥락에 맞춰서 무조건 '소변', '대변', 또는 '용변'이라는 단어로만 교체하여 작성해야 함 (예: '용변 처리를 지원함.', '소변 관리를 도움.', '대변 후 위생 처리를 지원함.').

[생활일지 작성 형식 및 규칙]
반드시 다음 양식을 정확하게 사용하여 출력해야 하며, 다른 여분의 설명글이나 마크다운 기호는 넣지 마십시오.
이용인의 이름은 결과 텍스트 내에 절대 포함하지 마십시오. 첫 줄부터 바로 아래의 "입퇴소 : " 항목으로 시작하여 출력합니다.
★가장 중요한 규칙: 각 항목(입퇴소, 위생과 청결, 식생활, 건강관리, 프로그램, 기타사항) 사이에는 절대로 빈 줄(공백 라인 / 빈 개행)을 사용하지 마십시오. 각 항목은 개행 한 번(\\n)만 사용하여 바로 아랫줄에 빈틈없이 붙여서 연달아 작성되어야 합니다.
사용자가 입력한 짧은 키워드나 요약글을 바탕으로, 각 항목당 '2~3문장의 충실한 전문 기록'으로 문맥을 살려 서술하십시오.

입퇴소 : (송영 여부 및 차량 승하차 상태, 차량 내에서의 이용인의 반응이나 자세, 안전 벨트 체결 및 직원과의 인사 나눔 등을 구체적으로 묘사하여 2~3문장의 전문 서술하되 명사형 종결)
위생과 청결 : (손씻기, 정리정돈, 위생 및 청결 상태 유지, 용모 상태, 소변/대변/용변 관리 및 처리 실태 등을 '배변'이라는 단어 없이 '소변', '대변', '용변'으로만 지칭하며 2~3문장의 전문 서술하되 명사형 종결)
식생활 : (식사량, 섭취/선호 반찬, 저작 및 연하 상태, 식사 예절과 대기 자세, 식사 후 식기 정리정돈, 수분 섭취 상태 등을 꼼꼼하게 풀어서 2~3문장의 전문 서술하되 명사형 종결)
건강관리 : (만약 사용자가 건강관리에 별도로 입력한 것이 없거나, 빈칸이거나, 단순 '정상'/'양호' 등인 경우, 다른 어떠한 추가 설명이나 임의의 문장도 붙이지 말고 오직 정확히 "양호함 / 체온: 정상"이라고만 똑같이 출력해야 함. 사용자가 기침, 복통, 구토, 투약 지원, 체온 측정 등 구체적인 이상 증세나 건강 상호작용을 명확하게 입력한 경우에만 해당 내용을 상세하게 2~3문장의 명사형 종결 문장으로 서술해야 함.)
프로그램 : (사용자가 입력한 프로그램 텍스트가 있다면 수정이나 가공 없이 그대로 출력하고, 별도 입력이 없거나 빈칸이면 '없음.'으로 출력)
기타사항 : (사용자가 기타사항을 입력하였을 때만 내용을 2~3문장의 분량으로 확장하여 상세히 서술하고, 사용자가 입력하지 않았거나 빈칸이거나 '작성하지 않음'인 경우에는 반드시 '없음.'만 출력할 것)

주의: 각 항목명 뒤에 반드시 띄어쓰기와 함께 콜론 ' :' 이 포함되도록 하십시오 (예: "입퇴소 : 송영차량 이용함.").

[프로그램일지 작성 형식 및 규칙]
이용인의 이름과 프로그램명은 결과 텍스트 내에 절대 포함하지 마십시오.
관찰내용, 지원내용, 의미 있는 반응, 그리고 입력된 경우의 차주 지원계획 등 모든 내용은 절대로 단락 구분, 줄바꿈, 글머리 기호 없이 처음부터 끝까지 물 흐르듯 자연스럽게 이어지는 완성도 높은 하나의 연속된 문단(3~5문장)으로 풍성하게 작성하십시오.
단순히 메모나 키워드를 나열하거나 입력 문장을 되풀이하지 말고, 활동 맥락 - 구체적 참여/행동 - 직원의 지원과 반응 - 종합적 참여 특성을 유기적으로 연결하여 전문적으로 기술하십시오.
`;

export async function generateCareLog(params: {
  body: GenerateLogRequest;
  headerApiKey?: string;
  defaultApiKey?: string;
  defaultModel?: string;
}): Promise<GenerateLogResult> {
  const { body, headerApiKey, defaultApiKey, defaultModel } = params;
  const { type, name, date, data, apiKey, model, names, clientTraits } = body;

  const customApiKey = (apiKey || headerApiKey) as string | undefined;
  const activeApiKey = (customApiKey && customApiKey.trim())
    ? customApiKey.trim()
    : (defaultApiKey || (process.env.GEMINI_API_KEY as string));

  if (!activeApiKey) {
    return {
      success: false,
      status: 400,
      error: "Gemini API 키가 설정되지 않았습니다. 상단 설정 메뉴에서 '관리자 전용 API 키'를 입력하시거나 Vercel 환경 변수(GEMINI_API_KEY)를 확인해 주십시오."
    };
  }

  let selectedModel = (model && model.trim())
    ? model.trim()
    : (defaultModel || process.env.GEMINI_MODEL || "gemini-3.1-flash-lite");

  // 구형 또는 지원 중단된 모델 요청 시 가장 빠르고 안정적인 모델(gemini-3.1-flash-lite)로 안전하게 자동 전환
  const deprecatedModels = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash-8b",
    "gemini-pro",
    "gemini-2.0-flash",
    "gemini-2.0-pro",
    "gemini-2.0-flash-thinking",
    "gemini-3.5-flash"
  ];
  if (deprecatedModels.includes(selectedModel)) {
    selectedModel = "gemini-3.1-flash-lite";
  }

  const activeAi = new GoogleGenAI({
    apiKey: activeApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const isBatch = Array.isArray(names) && names.length > 0;
  let userPrompt = "";

  if (isBatch) {
    userPrompt = `
유형: ${type}
날짜: ${date}

아래는 같은 반인 ${names.length}명의 이용인 명단과 각 이용인별 상세 입력 사항입니다.
★매우 중요: 각 이용인은 완전히 서로 다른 개별 인격체입니다.
어떤 특정 이용인의 칸에 적힌 돌발 행동(예: 신발 던지기, 발 구르기, 공격 행동 등)이나 메모를 다른 이용인의 기록에 절대로 복사하거나 섞지 마십시오!
각 이용인의 기록은 오직 해당 번호에 적힌 개별 메모와 등록된 평소 기본 특성을 근거로 독립적으로 작성되어야 합니다.

[이용인별 상세 입력 정보]
`;

    names.forEach((p: any, idx: number) => {
      userPrompt += `\n[이용인 ${idx + 1}] 성함: ${p.name}\n`;
      
      // 등록된 이용인 특징이 있는 경우
      if (p.traits) {
        const traitParts: string[] = [];
        if (p.traits.personality?.trim()) traitParts.push(`성향: ${p.traits.personality.trim()}`);
        if (p.traits.communication?.trim()) traitParts.push(`소통방식: ${p.traits.communication.trim()}`);
        if (p.traits.behaviorTraits?.trim()) traitParts.push(`행동특성/주의사항: ${p.traits.behaviorTraits.trim()}`);
        if (p.traits.notes?.trim()) traitParts.push(`기타특징: ${p.traits.notes.trim()}`);
        if (traitParts.length > 0) {
          userPrompt += `- 평소 기본 배경특성: ${traitParts.join(" | ")}\n`;
        }
      }

      if (type === "생활일지") {
        userPrompt += `- 입퇴소 및 송영: ${p.transit && p.transit.trim() ? p.transit.trim() : "일반적인 송영 서비스 이용"}\n`;
        userPrompt += `- 위생 및 청결: ${p.hygiene && p.hygiene.trim() ? p.hygiene.trim() : "일상적인 위생 및 청결 관리 원활함"}\n`;
        userPrompt += `- 식생활: ${p.diet && p.diet.trim() ? p.diet.trim() : "식사 섭취 양호함"}\n`;
        userPrompt += `- 건강관리: ${p.health && p.health.trim() ? p.health.trim() : "양호함 / 체온: 정상"}\n`;
        userPrompt += `- 프로그램: ${p.program && p.program.trim() ? p.program.trim() : ""}\n`;
        userPrompt += `- 기타사항: ${p.others && p.others.trim() ? p.others.trim() : ""}\n`;
      } else {
        // 프로그램 일지: 공통 프로그램명은 사용하되, 개별 관찰내용은 절대 타인의 것을 fallback하지 않음!
        const progName = (p.programName && p.programName.trim()) || (data?.programName && data.programName.trim()) || "";
        const obs = (p.observation && p.observation.trim()) || "";
        const sup = (p.support && p.support.trim()) || (data?.support && data.support.trim()) || "";
        const reac = (p.reaction && p.reaction.trim()) || "";
        const pln = (p.plan && p.plan.trim()) || "";

        userPrompt += `- 프로그램명: ${progName}\n`;
        userPrompt += `- 관찰내용: ${obs ? obs : "특이 돌발행동 없이 진행 순서에 따라 활동에 성실히 참여함"}\n`;
        userPrompt += `- 지원내용: ${sup ? sup : "활동 과정을 세심히 살피며 필요한 단계별 개별 지원 제공"}\n`;
        userPrompt += `- 의미 있는 반응: ${reac ? reac : "활동 과정에 집중하며 안정적인 참여 반응을 보임"}\n`;
        userPrompt += `- 차주 지원계획: ${pln ? pln : "빈칸(입력하지 않았음. 절대 마음대로 차주 지원계획이나 그에 관한 언급을 지어내서 적지 마십시오.)"}\n`;
      }
    });

    userPrompt += `
★작성 지침★
1. [지능적 배경 융합 & 풍성한 자율 서술]: 사용자가 적당히 간략한 키워드나 메모만 적었더라도, 각 이용인의 [평소 기본 배경특성](성향, 소통방식, 행동특성)을 적극적으로 읽어내어 직원의 맞춤 지원과 이용인의 긍정적 반응이 살아있는 전문적 문장으로 알아서 풍성하게 써주십시오. 사용자가 적은 말을 앵무새처럼 되풀이하지 마십시오.
2. [부정행동 날조 금지]: 타해, 폭력, 신발 던지기 등 극단적인 부정적 문제행동은 사용자가 메모에 적지 않은 한 결코 지어내지 마십시오.
3. [개별성 보장]: 특정 이용인의 관찰 메모(예: 신발 던지기)는 오직 그 이용인의 기록에만 들어가야 하며, 다른 이용인들에게 절대로 퍼뜨리지 마십시오.

★필수 중요 출력 형식 규칙★
여러 명의 이용인의 기록을 생성할 때는 반드시 각 이용인별 최종 생성된 일지 기록을 아래와 같이 명확한 태그로 감싸서 한 번에 줄줄이 출력해야 합니다.
여분의 설명글이나 마크다운 형식(예: \`\`\` 이나 ## 등)은 절대 추가하지 마십시오.

출력 형식 예시:
[START:홍길동]
(홍길동의 전문 기록 본문...)
[END:홍길동]
[START:김철수]
(김철수의 전문 기록 본문...)
[END:김철수]

반드시 위의 [START:이름]과 [END:이름] 태그 형식을 한치도 틀림없이 정확히 적용하여 응답해 주십시오. 각 이용인 일지 본문 내부에는 이용인의 이름을 노출하지 마십시오.
`;
  } else {
    userPrompt = `
유형: ${type}
이름: ${name || ""}
날짜: ${date || ""}
`;

    if (clientTraits) {
      const traitParts: string[] = [];
      if (clientTraits.personality?.trim()) traitParts.push(`성향: ${clientTraits.personality.trim()}`);
      if (clientTraits.communication?.trim()) traitParts.push(`소통방식: ${clientTraits.communication.trim()}`);
      if (clientTraits.behaviorTraits?.trim()) traitParts.push(`행동특성/주의사항: ${clientTraits.behaviorTraits.trim()}`);
      if (clientTraits.notes?.trim()) traitParts.push(`기타특징: ${clientTraits.notes.trim()}`);
      if (traitParts.length > 0) {
        userPrompt += `[평소 기본 배경특성]: ${traitParts.join(" | ")}\n`;
      }
    }

    if (type === "생활일지") {
      userPrompt += `
입력된 내용:
- 입퇴소: ${data?.transit && data.transit.trim() ? data.transit.trim() : "빈칸(일반적인 송영 서비스 이용)"}
- 위생과 청결: ${data?.hygiene && data.hygiene.trim() ? data.hygiene.trim() : "빈칸(원활함)"}
- 식생활: ${data?.diet && data.diet.trim() ? data.diet.trim() : "빈칸(양호함)"}
- 건강관리: ${data?.health && data.health.trim() ? data.health.trim() : "양호함 / 체온: 정상"}
- 프로그램: ${data?.program ? data.program.trim() : ""}
- 기타사항: ${data?.others ? data.others.trim() : ""}

※ 작성 지침:
1. [배경 융합 & 알아서 써주기]: 사용자가 '밥 잘 먹음', '산책 감'처럼 적당히 간략하게 입력했더라도, 이용인의 [평소 기본 배경특성]과 주간보호 일과의 맥락을 적극 활용하여 2~3문장의 매끄럽고 유려한 전문 기록으로 알아서 풍성하게 작성해 주십시오. 사용자의 짧은 단어만을 앵무새처럼 베껴 쓰지 마십시오.
2. [부정행동 날조 금지]: 타해, 폭력, 자해, 돌발행동 등 작성자가 명시하지 않은 부정적 사건은 절대로 지어내지 마십시오.
3. [금지어 엄수]: '배변' 단어 절대 금지 ('소변', '대변', '용변' 사용), '교사' 금지 ('직원' 사용), '대상자' 금지 ('이용인' 사용), '등원/하원' 금지 ('입소/퇴소' 사용).
    `;
    } else {
      userPrompt += `
입력된 내용:
- 프로그램명: ${data?.programName || ""}
- 관찰내용: ${data?.observation || ""}
- 지원내용: ${data?.support || ""}
- 의미 있는 반응: ${data?.reaction || ""}
- 차주 지원계획: ${data?.plan && data.plan.trim() ? data.plan.trim() : "빈칸(입력하지 않았음. 절대 마음대로 차주 지원계획이나 그에 관한 언급을 지어내서 적지 마십시오.)"}

※ 작성 지침:
1. [지능적 배경 융합 & 완성도 높은 서술]: 사용자가 거칠거나 간략한 키워드만 적었더라도, 이용인의 [평소 기본 배경특성](성향, 소통방식, 행동특성)을 적극적으로 읽어내어 '활동 맥락 - 이용인의 고유한 참여/행동 - 직원의 맞춤 지원 - 의미 있는 성취와 정서적 반응'을 유기적으로 엮어 3~5문장의 완성도 높은 한 문단으로 알아서 풍성하게 작성해 주십시오. 사용자가 적은 단어만 앵무새처럼 되풀이하지 마십시오.
2. [부정행동 날조 금지]: 타해, 폭력, 자해, 신발 던지기 등 입력되지 않은 극단적 돌발행동은 결코 상상하여 적지 마십시오.
3. [차주 지원계획]: 빈칸인 경우 절대로 지어내지 말고 생략하십시오.
    `;
    }
  }

  try {
    const config: any = {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.65, // 단순 복사/앵무새 탈피 및 이용인 배경 특성과의 자연스러운 문맥 융합
    };

    // gemini-3.8-flash의 경우 기본 Thinking(추론)이 HIGH로 동작하여 토큰 폭증/타임아웃을 유발하므로 LOW로 최적화
    if (selectedModel === "gemini-3.8-flash") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    const response = await activeAi.models.generateContent({
      model: selectedModel,
      contents: userPrompt,
      config,
    });

    return {
      success: true,
      status: 200,
      result: response.text || "",
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (isQuotaError(error)) {
      return {
        success: false,
        status: 429,
        error: "Gemini API 사용량 또는 속도 제한(429)에 도달했습니다. 3.1 Flash Lite 모델은 제한이 덜하며 빠르게 동작합니다. 잠시 후 다시 시도하시거나 상단 설정에서 개인 API 키를 연결해 주십시오."
      };
    }
    const message = error?.message ? ` (${error.message})` : "";
    return {
      success: false,
      status: 500,
      error: `기록 생성 중 일시적인 오류가 발생했습니다${message}. 'Gemini 3.1 Flash Lite' 모델로 변경 후 다시 시도해 보시기 바랍니다.`
    };
  }
}
