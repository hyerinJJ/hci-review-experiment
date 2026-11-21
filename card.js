/* =====================================================================
   상황 맞춤 칩 카드 (P1 전용)
   리뷰를 한참 내리는데 펼쳐 읽은 리뷰가 거의 없거나, 결정을 하려다
   "더 살펴볼게요"로 돌아오거나, 리뷰 화면에 오래 머무는 등 헤매는
   신호가 보일 때 리뷰 목록 사이에 칩 카드를 한 번 끼워 넣는다.
   P1 페이지의 메인 스크립트 뒤에 불러와야 한다 (st, R, CHIPS 등을 사용).
   ===================================================================== */
(function(){
  if(typeof CHIPS==='undefined'||typeof renderReviews!=='function')return;

  /* 트리거 기준. 파일럿 후 조정 */
  const CFG={
    scrollPass:10,   // 지나친 리뷰 수가 이 이상이고
    maxOpened:1,     // 펼쳐 읽은 리뷰가 이 이하일 때
    timeSec:150,     // 리뷰 화면에 이만큼(초) 머물렀는데 칩을 안 썼을 때
    showN:3          // 로그에 남길 앞쪽 칩 수 (화면 첫 줄에 보이는 칩)
  };

  /* 상품별로 카드에 올릴 후보 칩 (구매 결정에 중요한 걱정 위주, 앞에 있을수록 우선)
     pair: 카드 위쪽에 함께 보여줄 대비 항목 (답 미리보기) */
  const PLAN={
    '닭가슴살':{cand:['juicy','thaw','bad','amt','cook','diet','again'],pair:['juicy','thaw','bad']},
    '보조배터리':{cand:['heavy','wt','slow','cnt','heat','bad','time','trip'],pair:['wt','heavy']},
    '트레이닝복':{cand:['sz2','sz1','sz0','len','see','wash','wst','fur'],pair:['sz0','sz1','sz2']}
  };
  const plan=PLAN[PRODUCT];if(!plan)return;
  const byId=id=>CHIPS.find(s=>s.id===id);

  let state='idle';      // idle | shown | tapped | closed
  let trigger='', anchor=null, shownChips=[], reviewsSince=null;

  const css=document.createElement('style');
  css.textContent=`
  .ccard{margin:14px 16px;padding:14px 0 14px;border:1px solid #e3e6ea;border-radius:12px;background:#fafbfc;overflow:hidden}
  .ccard .cc-h{display:flex;align-items:center;gap:8px;padding:0 10px 0 14px}
  .ccard .cc-h b{flex:1;font-size:15.5px}
  .ccard .cc-h small{margin-left:6px;font-weight:400;font-size:12.5px;color:#7a7f88}
  .ccard .cc-x{flex:none;width:28px;height:28px;border:0;background:none;color:#8a8f98;font-size:20px;line-height:1;cursor:pointer}
  .ccard .cats{gap:8px;padding:10px 14px 0}
  .ccard .chip{height:36px;padding:0 14px;border:1px solid #dfe3e8;border-radius:18px;font-size:14.5px;font-weight:600;color:#333;gap:5px}
  .ccard .chip small{font-size:12.5px;font-weight:700;color:#8a8f98}`;
  document.head.appendChild(css);

  /* AI 맞춤 선택칩 전체를 넣되, 사용자가 오래 본 리뷰의 주제와 구매 걱정 항목이 앞에 오도록 정렬 */
  function pickChips(){
    if(typeof flushVis==='function')flushVis();
    const dwell={};
    for(const id in seen){const r=R[+id];if(!r)continue;for(const t of r.t)dwell[t]=(dwell[t]||0)+seen[id]}
    const L=plan.cand.length;
    return CHIPS.map((sp,k)=>{const i=plan.cand.indexOf(sp.id);
      return {sp,score:(dwell[sp.id]||0)/1000+(CHIP_N[sp.id]||0)*0.05+(i<0?0:(L-i)*0.3)-k*0.001}})
      .sort((a,b)=>b.score-a.score).map(x=>x.sp);
  }
  function cardHTML(){
    return `<div class="ccard" id="ccard" role="region" aria-label="AI 맞춤 선택칩 추천">
      <div class="cc-h"><b>찾는 내용이 있으세요?<small>보신 후기 기준 추천</small></b>
      <button class="cc-x" data-cc="close" aria-label="닫기">×</button></div>
      <div class="cats">${shownChips.map(s=>`<button class="chip" data-cc="chip" data-v="${s.id}">${s.label}<small>${CHIP_N[s.id]}</small></button>`).join('')}</div>
    </div>`;
  }
  function placeCard(){
    const old=document.getElementById('ccard');if(old)old.remove();
    if(state!=='shown'||st.chip||view!=='reviews')return;
    const list=document.getElementById('list');if(!list)return;
    const cards=[...list.querySelectorAll('.card')];if(!cards.length)return;
    let after=anchor!=null?list.querySelector(`.card[data-rid="${anchor}"]`):null;
    if(after)after.insertAdjacentHTML('afterend',cardHTML());
    else cards[0].insertAdjacentHTML('beforebegin',cardHTML());
  }
  function show(reason){
    if(state!=='idle'||st.chip)return;
    shownChips=pickChips();if(!shownChips.length)return;
    trigger=reason;state='shown';
    /* 화면 아래쪽에 곧 나타날 위치에 끼워 넣기 */
    anchor=null;
    if(view==='reviews'){
      const cards=[...document.querySelectorAll('#list .card')];
      const next=cards.find(c=>c.getBoundingClientRect().top>innerHeight*0.6);
      const idx=next?cards.indexOf(next):cards.length;
      anchor=idx>0?cards[idx-1].dataset.rid:null;
    }
    placeCard();
    log('chip_card_show',{trigger:reason,chips:shownChips.slice(0,CFG.showN).map(s=>s.label).join('|')});
  }

  /* 리뷰 목록이 다시 그려져도 카드 위치 유지 */
  const _render=renderReviews;
  renderReviews=function(){_render.apply(this,arguments);placeCard()};

  /* 결정하려다 "더 살펴볼게요"로 돌아온 경우 */
  const _log=log;
  log=function(type,data){
    _log(type,data);
    if(type==='decide_cancel')setTimeout(()=>show('decide_cancel'),300);
    if(type==='view'&&data&&data.to==='reviews'){reviewsSince=performance.now();setTimeout(placeCard,50)}
  };

  /* 많이 내렸는데 거의 펼쳐 읽지 않은 경우 */
  let tk=0;
  addEventListener('scroll',()=>{
    if(view!=='reviews'||state!=='idle'||tk)return;
    tk=setTimeout(()=>{tk=0;
      const passed=[...document.querySelectorAll('#list .card')].filter(c=>c.getBoundingClientRect().bottom<0).length;
      const opened=LOG?new Set(LOG.events.filter(e=>e.type==='open_review').map(e=>e.id)).size:0;
      if(passed>=CFG.scrollPass&&opened<=CFG.maxOpened)show('scroll');
    },250);
  },{passive:true});

  /* 리뷰 화면에 오래 머무는 경우 */
  setInterval(()=>{
    if(view==='reviews'&&state==='idle'&&reviewsSince&&!st.chip&&(performance.now()-reviewsSince)/1000>=CFG.timeSec)show('time');
  },5000);

  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-cc]');if(!t)return;
    e.stopPropagation();
    if(t.dataset.cc==='close'){
      state='closed';const c=document.getElementById('ccard');if(c)c.remove();
      log('chip_card_close',{trigger});
    }else if(t.dataset.cc==='chip'){
      const sp=byId(t.dataset.v);if(!sp)return;
      state='tapped';st.chip=sp.id;st.page=1;renderReviews();
      log('chip_card_tap',{trigger,v:sp.id,label:sp.label});
      log('chip',{v:sp.id,label:sp.label,on:true,place:'card'});
      const fz=document.getElementById('fz');if(fz)fz.scrollIntoView({block:'start'});
    }
  },true);

  /* 요약에 카드 관련 항목 추가 */
  const _summary=summary;
  summary=function(){
    const s=_summary.apply(this,arguments),ev=LOG?LOG.events:[];
    const sh=ev.find(e=>e.type==='chip_card_show'),tp=ev.find(e=>e.type==='chip_card_tap');
    return {...s,card_trigger:sh?sh.trigger:'',card_shown_at:sh?sh.t:'',card_chips:sh?sh.chips:'',
      card_tapped:tp?tp.label:'',card_closed:ev.some(e=>e.type==='chip_card_close')?1:0};
  };
})();
