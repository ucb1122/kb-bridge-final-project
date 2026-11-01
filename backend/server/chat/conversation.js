export function conversationalReply(question){
  const text=String(question).trim();
  if(/(?:이름|누구|정체).*(?:뭐|누구|알려|소개)|(?:너|넌|당신).*(?:이름|누구)/.test(text))
    return '저는 상권브릿지의 안내 챗봇 코비예요. 상권 분석, 회복 플래너, 상담 준비 화면을 이해하는 데 도움을 드릴게요.';
  if(/^(?:안녕|안녕하세요|반가워|하이)[!?.\s]*$/.test(text))
    return '안녕하세요! 저는 상권브릿지 안내 챗봇 코비예요. 어떤 점이 궁금하세요?';
  if(/(?:오늘|내일|이번 주|현재).{0,8}날씨|날씨.{0,8}(?:어때|알려|어떻)/.test(text))
    return '실시간 날씨는 이 챗봇에서 확인할 수 없어요. 지역과 날짜를 정해 기상청 날씨누리에서 확인해 주세요.';
  return null;
}
