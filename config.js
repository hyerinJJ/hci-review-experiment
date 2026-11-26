/* 실험 설정
   GAS_URL: Apps Script 웹 앱 주소 (https://script.google.com/macros/s/.../exec)
   비워 두면 관리자 화면에서 기기별로 넣은 주소를 씁니다. */
window.LAB_CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbxyfQUk-hnL_bw5A8YkMJ0WzpIEgVaC9BN5BHIvPckLGxJoOVtd8TAy8OJLpkH-zOi5/exec",
  /* 리뷰 작성 activity (말로 쓰는 리뷰) 주소 */
  WRITE_URL: "https://ai-review-chat.vercel.app/",
  /* 참여자별 리뷰 작성 activity 품목 (사전에 받은 품목, P2의 ?item= 값). 없으면 닭가슴살 */
  WRITE_ITEM: { A: "light" },
  /* 조건 배치표: 참가자별 구매 판단 과제 1, 2 */
  PLAN: {
    A: [["chicken", "base"], ["battery", "p1"]],
    B: [["battery", "p1"], ["pants", "base"]],
    C: [["pants", "base"], ["chicken", "p1"]],
    D: [["chicken", "p1"], ["battery", "base"]],
    E: [["battery", "base"], ["pants", "p1"]]
  }
};
