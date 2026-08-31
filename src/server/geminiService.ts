import { GoogleGenAI } from "@google/genai";

export interface GenerateLogRequest {
  type: string;
  name?: string;
  date?: string;
  data: any;
  apiKey?: string;
  model?: string;
  names?: any[];
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
당신은 CareLog의 AI 기록 도우미로서, 장애인 주간이용시설 직원의 기록 작성을 지원합니다.

[공통 규칙]
- 실제 관찰한 것처럼 매우 구체적이고 현실적으로 작성함.
- 반복되는 표현을 최소화하고 문장을 대단히 다양하고 생생하게 작성함.
- 모든 문장은 전문적인 느낌이 나도록 '~함.', '~음.', '~임.' 등 명사형 종결 어미를 사용하여 간결하게 작성함 (예: '수행함.', '관찰됨.', '표현함.', '좋아함.').
- 과장된 긍정 표현을 주저없이 배제하고 객관적으로 작성함.
- 이용인의 행동 특성과 상황을 자연스럽게 반영함.
- 너무 딱딱하지 않되 전문적인 문체를 유지함.
- 짧은 내용이라도 의미 있는 행동 변화를 포함함.
- 복사하기 쉽게 일반 텍스트만 사용함.
- 글머리기호, 마크다운 기호, 번호 매기기 기호(예: - , * 등) 사용을 철저히 금지함.
- 없는 내용을 허무맹랑하게 꾸며내지 않으면서도, 입력된 핵심 정보를 토대로 주변 상황 묘사, 구체적인 행동, 이용인의 반응, 직원의 지지적인 중재 방법 등을 살려 풍성하게 확장하여 전문적으로 서술해야 함.
- '교사'나 '사회복지사'라는 단어는 절대 사용하지 말고, 대신 '직원'이라는 단어만 사용해야 함 (예: '직원의 지원을 받아', '직원이 이동을 동행함').
- '대상자'라는 단어는 절대 사용하지 말아야 하며, 반드시 '이용인'이라는 단어만 사용해야 함.
- '등원', '하원'이라는 단어는 일절 사용하지 말아야 하며, 반드시 '입소', '퇴소'라는 단어만 사용해야 함 (예: '입소차량을 이용함.', '안전하게 퇴소함.').
- ★[매우 중요] '배변'이라는 단어는 일절 사용하지 말아야 함. '배변관리', '배변활동' 등 모든 변형에 대해서도 '배변'이라는 표현 대신 구체적이고 적절한 맥락에 맞춰서 무조건 '소변', '대변', 또는 '용변'이라는 단어로만 교체하여 작성해야 함 (예: '용변 처리를 지원함.', '소변 관리를 도움.', '대변 후 위생 처리를 지원함.').
- ★[매우 중요] 항목별 기록 분량 제한: 사용자가 입력한 짧은 키워드나 요약글을 바탕으로, 각 항목당 "정확히 2~3문장"의 분량으로 작성해 주십시오. 4문장 이상으로 길어지지 않게 깔끔하게 조절하되, 단순 요약이 아니라 이용인의 행동 양상, 개별 반응 및 변화, 감정 표출 방식, 직원이 제공한 구체적인 안내·촉진·안전 지원·칭찬과 격려 등의 실질적 활동을 2~3문장 내에 조밀하고 상세하게 묘사하여, 전문성과 가독성을 모두 확보해야 합니다. (단, 건강관리 항목이 빈칸이거나 단순 정상일 때 "양호함 / 체온: 정상"으로 출력하는 규정은 예외로 함)

[생활일지 작성 형식 및 규칙]
반드시 다음 양식을 정확하게 사용하여 출력해야 하며, 다른 여분의 설명글이나 마크다운 기호는 넣지 마십시오.
이용인의 이름은 결과 텍스트 내에 절대 포함하지 마십시오. 첫 줄부터 바로 아래의 "입퇴소 : " 항목으로 시작하여 출력합니다.
★가장 중요한 규칙: 각 항목(입퇴소, 위생과 청결, 식생활, 건강관리, 프로그램, 기타사항) 사이에는 절대로 빈 줄(공백 라인 / 빈 개행)을 사용하지 마십시오. 각 항목은 개행 한 번(\\n)만 사용하여 바로 아랫줄에 빈틈없이 붙여서 연달아 작성되어야 합니다.

입퇴소 : (송영 여부 및 차량 승하차 상태, 차량 내에서의 이용인의 반응이나 자세, 안전 벨트 체결 및 직원과의 인사 나눔 등을 구체적으로 묘사하여 2~3문장의 깔끔한 분량으로 전문 서술하되 명사형 종결)
위생과 청결 : (손씻기, 정리정돈, 위생 및 청결 상태 유지, 머리나 옷차림 등의 용모 상태, 소변/대변/용변 관리 및 처리 실태, 뒤처리 지원 시 이용인의 협조 여부 등을 '배변'이라는 단어 없이 '소변', '대변', '용변'으로만 지칭하며 매우 상세하고 생생하게 늘려 2~3문장의 깔끔한 분량으로 전문 서술하되 명사형 종결)
식생활 : (식사량, 선호 반찬, 저작 및 연하 상태, 식사 예절과 대기 자세, 식사 후 식기 정리정돈, 수분 섭취 상태, 식사 중 직원의 지도와 이용인의 협조 반응 등을 꼼꼼하게 풀어서 2~3문장의 깔끔한 내용으로 전문 서술하되 명사형 종결)
건강관리 : (만약 사용자가 건강관리에 별도로 입력한 것이 없거나, 빈칸이거나, 단순 '정상'/'양호' 등인 경우, 다른 어떠한 추가 설명이나 임의의 문장도 붙이지 말고 오직 정확히 "양호함 / 체온: 정상"이라고만 똑같이 출력해야 함. 사용자가 기침, 복통, 구토, 투약 지원, 체온 측정 등 구체적인 이상 증세나 건강 상호작용을 명확하게 입력한 경우에만 해당 내용을 상세하게 2~3문장의 깔끔한 전문 문장으로 서술해야 함.)
프로그램 : (사용자가 입력한 프로그램 텍스트가 있다면 수정이나 가공 없이 그대로 출력하고, 별도 입력이 없거나 빈칸이면 '없음.'으로 출력)
기타사항 : (사용자가 기타사항을 입력하였을 때만 내용을 2~3문장의 분량으로 확장하여 상세히 서술하고, 사용자가 입력하지 않았거나 빈칸이거나 '작성하지 않음'인 경우에는 반드시 '없음.'만 출력할 것)

주의: 각 항목명 뒤에 반드시 띄어쓰기와 함께 콜론 ' :' 이 포함되도록 하십시오 (예: "입퇴소 : 송영차량 이용함.").

[프로그램일지 작성 형식 및 규칙]
이용인의 이름과 프로그램명은 결과 텍스트 내에 절대 포함하지 마십시오.
관찰내용, 지원내용, 의미 있는 반응, 그리고 입력된 경우의 차주 지원계획 등 모든 내용은 절대로 단락 구분, 줄바꿈, 글머리 기호 없이 처음부터 끝까지 물 흐르듯 자연스럽게 이어지는 연속된 문장들로 구성하여 풍성하게 작성하십시오. (전체적으로 기록의 양을 4~5문장 정도의 깔끔하고 실속 있는 한 단락으로 작성할 것)
특히, 차주 지원계획은 사용자가 명시적으로 입력하였을 때만 다른 내용들처럼 자연스럽게 글 끝머리에 한 문장으로 부드럽게 이어서 기술해야 합니다. 만약 사용자가 차주 지원계획에 아무것도 입력하지 않았거나 빈칸이거나 작성하지 않은 경우, 절대로 차주 지원계획을 상상하거나 추측하여 지어내지 말아야 하며 오직 관찰내용, 지원내용, 의미 있는 반응까지만 서술하고 끝마쳐야 합니다. '교사'라는 표현은 일절 금지하며 '직원'을 사용할 것.
`;

export async function generateCareLog(params: {
  body: GenerateLogRequest;
  headerApiKey?: string;
  defaultApiKey?: string;
  defaultModel?: string;
}): Promise<GenerateLogResult> {
  const { body, headerApiKey, defaultApiKey, defaultModel } = params;
  const { type, name, date, data, apiKey, model, names } = body;

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

  const selectedModel = (model && model.trim())
    ? model.trim()
    : (defaultModel || process.env.GEMINI_MODEL || "gemini-3.1-flash-lite");

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
각 이용인별로 제공된 개별 입력 정보(공통 정보가 적용되었을 수 있음)를 가공하여 **각 이용인별로 완전히 독립된 전문적인 기록**을 개별적으로 생성해 주세요.

[이용인별 상세 입력 정보]
`;

    names.forEach((p: any, idx: number) => {
      userPrompt += `\n${idx + 1}. 이름: ${p.name}\n`;
      if (type === "생활일지") {
        userPrompt += `- 입퇴소 및 송영: ${p.transit ? p.transit.trim() : (data?.transit ? data.transit.trim() : "빈칸(일반적인 송영 서비스 이용)")}\n`;
        userPrompt += `- 위생 및 청결: ${p.hygiene ? p.hygiene.trim() : (data?.hygiene ? data.hygiene.trim() : "빈칸(원활함)")}\n`;
        userPrompt += `- 식생활: ${p.diet ? p.diet.trim() : (data?.diet ? data.diet.trim() : "빈칸(양호함)")}\n`;
        userPrompt += `- 건강관리: ${p.health ? p.health.trim() : (data?.health ? data.health.trim() : "양호함 / 체온: 정상")}\n`;
        userPrompt += `- 프로그램: ${p.program ? p.program.trim() : (data?.program ? data.program.trim() : "")}\n`;
        userPrompt += `- 기타사항: ${p.others ? p.others.trim() : (data?.others ? data.others.trim() : "")}\n`;
      } else {
        userPrompt += `- 프로그램명: ${p.programName ? p.programName.trim() : (data?.programName ? data.programName.trim() : "")}\n`;
        userPrompt += `- 관찰내용: ${p.observation ? p.observation.trim() : (data?.observation ? data.observation.trim() : "")}\n`;
        userPrompt += `- 지원내용: ${p.support ? p.support.trim() : (data?.support ? data.support.trim() : "")}\n`;
        userPrompt += `- 의미 있는 반응: ${p.reaction ? p.reaction.trim() : (data?.reaction ? data.reaction.trim() : "")}\n`;
        userPrompt += `- 차주 지원계획: ${p.plan ? p.plan.trim() : (data?.plan && data.plan.trim() ? data.plan.trim() : "빈칸(입력하지 않았음. 절대 마음대로 차주 지원계획이나 그에 관한 언급을 지어내서 적지 마십시오.)")}\n`;
      }
    });

    userPrompt += `

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

반드시 위의 [START:이름]과 [END:이름] 태그 형식을 한치도 틀림없이 정확히 적용하여 응답해 주십시오. 각 이용인 일지 본문 내부에는 이용인의 이름을 노출하지 마십시오 (형식 규칙에 맞춰 본문만 작성).
`;
  } else {
    userPrompt = `
유형: ${type}
이름: ${name || ""}
날짜: ${date || ""}
`;

    if (type === "생활일지") {
      userPrompt += `
입력된 내용:
- 입퇴소: ${data?.transit ? data.transit.trim() : "빈칸(일반적인 송영 서비스 이용)"}
- 위생과 청결: ${data?.hygiene ? data.hygiene.trim() : "빈칸(원활함)"}
- 식생활: ${data?.diet ? data.diet.trim() : "빈칸(양호함)"}
- 건강관리: ${data?.health ? data.health.trim() : "양호함 / 체온: 정상"}
- 프로그램: ${data?.program ? data.program.trim() : ""}
- 기타사항: ${data?.others ? data.others.trim() : ""}
    `;
    } else {
      userPrompt += `
입력된 내용:
- 프로그램명: ${data?.programName || ""}
- 관찰내용: ${data?.observation || ""}
- 지원내용: ${data?.support || ""}
- 의미 있는 반응: ${data?.reaction || ""}
- 차주 지원계획: ${data?.plan && data.plan.trim() ? data.plan.trim() : "빈칸(입력하지 않았음. 절대 마음대로 차주 지원계획이나 그에 관한 언급을 지어내서 적지 마십시오.)"}
    `;
    }
  }

  try {
    const response = await activeAi.models.generateContent({
      model: selectedModel,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
      },
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
        error: "Gemini API 사용량 또는 속도 제한에 도달했습니다. 입력된 기록은 브라우저에 보존되어 있으니 잠시 후 다시 시도하시거나, 개인/기관용 Gemini API 키를 설정해 주십시오. 계속 발생하면 Google AI Studio에서 해당 프로젝트의 실제 Rate limit/RPD와 결제 연결 상태를 확인해야 합니다."
      };
    }
    return {
      success: false,
      status: 500,
      error: "기록 생성 중 일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주십시오."
    };
  }
}
