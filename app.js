/* Hippy List — tie-dye order shop. Standalone web app.
   Backend: Supabase (auth + Postgres + storage) when config.js is filled;
   otherwise a local demo mode (localStorage) so it runs anywhere.
   Sections: Board · Orders · Customers · Inventory · Reports · Pricing. */
(function(){
"use strict";

/* ─────────── Config / backend ─────────── */
const CFG = window.HIPPY_CONFIG || {};
const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
const sb = LIVE ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
const LS = "hippylist.app.v1";
const APP_VERSION = "202610190016";
/* Auto-update: phones and home-screen apps cache files, so check for a newer deploy and reload into it. */
async function checkUpdate(){ try{ const r=await fetch("version.json?t="+Date.now(),{cache:"no-store"}); if(!r.ok) return; const {v}=await r.json(); if(v&&v!==APP_VERSION&&!sessionStorage.getItem("hl-upd-"+v)){ sessionStorage.setItem("hl-upd-"+v,"1"); location.replace(location.pathname+"?v="+v); } }catch(e){} }
checkUpdate(); document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") checkUpdate(); });

/* ─────────── Domain ─────────── */
const STAGES = [
  {key:"new",label:"New",color:"var(--s-new)",hex:"#7b4dd6"},
  {key:"queued",label:"Queued",color:"var(--s-queued)",hex:"#2f72c4"},
  {key:"dyeing",label:"Dyeing",color:"var(--s-dyeing)",hex:"#189e86"},
  {key:"rinse",label:"Rinse & wash",color:"var(--s-rinse)",hex:"#2f9c6a"},
  {key:"drying",label:"Drying",color:"var(--s-drying)",hex:"#8fae1f"},
  {key:"ready",label:"Ready",color:"var(--s-ready)",hex:"#e0a318"},
  {key:"delivered",label:"Delivered",color:"var(--s-delivered)",hex:"#c0405f"},
];
const stageOf = k => STAGES.find(s=>s.key===k)||STAGES[0];
const stageIdx = k => Math.max(0,STAGES.findIndex(s=>s.key===k));

const DEFAULT_PRICING = {
  laborRate:25, markup:2.2, roundTo:0.5,
  rush:{type:"percent",amount:25},
  taxRate:0,
  materials:[
    {name:"Fiber-reactive dye",cost:0.60,per:"color"},
    {name:"Soda ash soak",cost:0.25,per:"piece"},
    {name:"Bottles / gloves",cost:0.40,per:"piece"},
    {name:"Rinse & bag",cost:0.60,per:"piece"},
  ],
  blanks:[
    {name:"Cotton tee",cost:4.5},{name:"Heavyweight tee",cost:7},{name:"Long sleeve",cost:8},
    {name:"Crewneck",cost:14},{name:"Hoodie",cost:18},{name:"Sweatpants",cost:16},
    {name:"Tote",cost:3.5},{name:"Bandana",cost:2},{name:"Socks (pair)",cost:3},{name:"Youth tee",cost:4},
  ],
  techniques:[
    {name:"Spiral",min:6},{name:"Crumple",min:4},{name:"Bullseye",min:7},{name:"Sunburst",min:8},
    {name:"Stripes / fold",min:6},{name:"Scrunch",min:4},{name:"Ice dye",min:12},{name:"Shibori",min:15},
    {name:"Reverse (bleach)",min:8},{name:"Solid dip",min:3},
  ],
};
const PALETTES=["Rainbow","Classic blue","Sunset","Earth / forest","Pastel","Monochrome","Neon","Black & white","Custom"];
const SIZES=["YS","YM","YL","XS","S","M","L","XL","2XL","3XL","OS"];

/* ─────────── Demo seed (local mode / first run) ─────────── */
function seed(){
  const d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
  const past=m=>{const x=new Date();x.setMonth(x.getMonth()-m);return x.toISOString();};
  return {
    orders:[
      {id:"o1",ref:1042,status:"dyeing",customer:{name:"Riverside Yoga Studio",phone:"(513) 555-0142",email:"hello@riversideyoga.co",kind:"wholesale"},items:[{garment:"Cotton tee",size:"L",qty:12,technique:"Spiral",palette:"Earth / forest",colors:3,price:22}],deposit:40,paid:false,photos:[],notes:"Matching spirals across the batch.",createdAt:past(0)},
      {id:"o2",ref:1043,status:"new",customer:{name:"Marcus Delacroix",phone:"(513) 555-0199",email:"",kind:"retail"},items:[{garment:"Hoodie",size:"XL",qty:1,technique:"Ice dye",palette:"Sunset",colors:4,price:58},{garment:"Cotton tee",size:"M",qty:2,technique:"Crumple",palette:"Neon",colors:2,price:20}],deposit:0,paid:false,photos:[],notes:"",createdAt:past(0)},
      {id:"o3",ref:1044,status:"queued",customer:{name:"Tops Market Popup",phone:"",email:"booking@topsmarket.com",kind:"wholesale"},items:[{garment:"Cotton tee",size:"L",qty:40,technique:"Spiral",palette:"Rainbow",colors:5,price:18}],deposit:200,paid:false,photos:[],notes:"Popup table — needs by the 2nd.",createdAt:past(0)},
      {id:"o4",ref:1041,status:"ready",customer:{name:"Sunset Collective",phone:"",email:"",kind:"wholesale"},items:[{garment:"Heavyweight tee",size:"L",qty:24,technique:"Sunburst",palette:"Sunset",colors:4,price:22.5}],deposit:540,paid:true,photos:[],notes:"",createdAt:past(1)},
      {id:"o5",ref:1040,status:"delivered",customer:{name:"Bea Holloway",phone:"(513) 555-0170",email:"",kind:"retail"},items:[{garment:"Crewneck",size:"M",qty:6,technique:"Shibori",palette:"Monochrome",colors:2,price:28}],deposit:0,paid:true,photos:[],notes:"",createdAt:past(1)},
      {id:"o6",ref:1039,status:"delivered",customer:{name:"Jonah R.",phone:"",email:"",kind:"retail"},items:[{garment:"Tote",size:"OS",qty:5,technique:"Scrunch",palette:"Pastel",colors:3,price:19}],deposit:0,paid:true,photos:[],notes:"",createdAt:past(2)},
    ],
    customers:[], inventory:[
      {id:"i1",kind:"blank",name:"Cotton tee",on_hand:46,reorder_at:24,unit:"ea"},
      {id:"i2",kind:"blank",name:"Hoodie",on_hand:7,reorder_at:10,unit:"ea"},
      {id:"i3",kind:"blank",name:"Heavyweight tee",on_hand:30,reorder_at:12,unit:"ea"},
      {id:"i4",kind:"material",name:"Fiber-reactive dye",on_hand:4,reorder_at:6,unit:"jars"},
      {id:"i5",kind:"material",name:"Soda ash",on_hand:2,reorder_at:2,unit:"bags"},
    ],
    pricing:clone(DEFAULT_PRICING),
    settings:{shop:"Shaggy's Tie-Dye", owner:"Shaggy Sounds"},
  };
}

/* ─────────── State ─────────── */
let S={orders:[],customers:[],inventory:[],pricing:clone(DEFAULT_PRICING),settings:{shop:"Hippy List",owner:""}};
let tab="board", draft=freshDraft(), editId=null, search="", openId=null, openKind="order";
let session=null, authEmail="";

/* ─────────── Boot ─────────── */
async function boot(){
  if(LIVE){
    const {data}=await sb.auth.getSession(); session=data.session;
    sb.auth.onAuthStateChange((_e,s)=>{ session=s; if(s){ loadLive(); } else renderApp(); });
    if(session) await loadLive(); else renderApp();
  } else {
    loadLocal(); renderApp();
  }
  document.getElementById("scrim").onclick=closeDrawer;
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeDrawer(); });
}

/* ─────────── Data: live (Supabase) ─────────── */
async function loadLive(){
  try{
    const [o,c,i,p] = await Promise.all([
      sb.from("orders").select("*").order("created_at",{ascending:false}),
      sb.from("customers").select("*").order("name"),
      sb.from("inventory").select("*").order("name"),
      sb.from("pricing").select("data").maybeSingle(),
    ]);
    S.orders=(o.data||[]).map(rowToOrder);
    S.customers=c.data||[];
    S.inventory=i.data||[];
    S.pricing=p.data&&p.data.data?normalizePricing(p.data.data):clone(DEFAULT_PRICING);
    if(S.pricing.settings) S.settings=Object.assign(S.settings,S.pricing.settings);
    await reconcileLists();
    subscribeLive();
  }catch(e){ toast("Couldn't load — check connection"); }
  renderApp();
}
let subbed=false;
function subscribeLive(){
  if(subbed) return; subbed=true;
  sb.channel("hippy").on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>refetch("orders"))
    .on("postgres_changes",{event:"*",schema:"public",table:"customers"},()=>refetch("customers"))
    .on("postgres_changes",{event:"*",schema:"public",table:"inventory"},()=>refetch("inventory")).subscribe();
}
async function refetch(t){
  if(t==="orders"){const {data}=await sb.from("orders").select("*").order("created_at",{ascending:false});S.orders=(data||[]).map(rowToOrder);}
  if(t==="customers"){const {data}=await sb.from("customers").select("*").order("name");S.customers=data||[];}
  if(t==="inventory"){const {data}=await sb.from("inventory").select("*").order("name");S.inventory=data||[];}
  if(isTyping()) return; renderApp(); if(openId) renderDrawer();
}
function isTyping(){const a=document.activeElement;return !!(a&&a.matches&&a.matches("input,textarea,select")&&(document.getElementById("view")||{contains:()=>false}).contains(a));}
function rowToOrder(r){ return {id:r.id,ref:r.ref,status:r.status,customer:r.customer||{},items:r.items||[],deposit:+r.deposit||0,orderCharge:+r.order_charge||0,paid:!!r.paid,photos:r.photos||[],notes:r.notes||"",createdAt:r.created_at}; }
function orderToRow(o){ return {status:o.status,customer:o.customer,items:o.items,deposit:o.deposit,order_charge:o.orderCharge||0,paid:!!o.paid,photos:o.photos||[],notes:o.notes||""}; }

/* ─────────── Data: local ─────────── */
function loadLocal(){
  try{ const raw=localStorage.getItem(LS); if(raw){ const d=JSON.parse(raw); S=Object.assign(S,d); S.pricing=normalizePricing(S.pricing); reconcileLists(); return; } }catch(e){}
  S=seed(); S.pricing=normalizePricing(S.pricing); reconcileLists();
}
function saveLocal(){ if(LIVE) return; try{ localStorage.setItem(LS,JSON.stringify(S)); }catch(e){} }

/* ─────────── Pricing engine ─────────── */
function blankCost(n){const b=S.pricing.blanks.find(x=>x.name===n);return b?+b.cost||0:0;}
function techMin(n){const t=S.pricing.techniques.find(x=>x.name===n);return t?+t.min||0:0;}
function matSum(per){return (S.pricing.materials||[]).filter(m=>m.per===per).reduce((s,m)=>s+(+m.cost||0),0);}
function roundP(v){const r=+S.pricing.roundTo||0;return r<=0?Math.round(v*100)/100:Math.ceil(v/r)*r;}
function itemCost(it){return blankCost(it.garment)+(techMin(it.technique)/60)*(+S.pricing.laborRate||0)+matSum("piece")+(+it.colors||0)*matSum("color");}
function suggestP(it){return roundP(itemCost(it)*(+S.pricing.markup||1));}
function itemUnit(it){return (it.price===""||it.price==null)?suggestP(it):+it.price||0;}
function orderChargeLive(){const r=matSum("order")*(+S.pricing.markup||1);return r>0?roundP(r):0;}
function orderSubtotal(o){return (o.items||[]).reduce((s,it)=>s+itemUnit(it)*(+it.qty||0),0);}
function rushLive(o){const r=S.pricing.rush||{},a=+r.amount||0;if(a<=0)return 0;if(r.type==="flat")return a;if(r.type==="piece")return a*orderPieces(o);return roundP(orderSubtotal(o)*a/100);}
function rushOf(o){const c=o.customer||{};if(!c.rush)return 0;return c.rushFee!=null?+c.rushFee||0:rushLive(o);}
function rushLabel(){const r=S.pricing.rush||{},a=+r.amount||0;return r.type==="flat"?`+${money(a)}`:r.type==="piece"?`+${money(a)}/pc`:`+${a}%`;}
function taxExempt(o){const c=o.customer||{};return c.taxExempt!=null?!!c.taxExempt:c.kind==="wholesale";}
function taxRateOf(o,live){const c=o.customer||{};return c.taxRate!=null?+c.taxRate||0:(live?+S.pricing.taxRate||0:0);}
function taxOf(o,live){if(taxExempt(o))return 0;const r=taxRateOf(o,live);if(r<=0)return 0;const c=(o.orderCharge!=null)?+o.orderCharge||0:orderChargeLive();return Math.round((orderSubtotal(o)+c+rushOf(o))*r)/100;}
function orderTotal(o){const c=(o.orderCharge!=null)?+o.orderCharge||0:orderChargeLive();return orderSubtotal(o)+c+rushOf(o)+taxOf(o);}
function orderCost(o){return (o.items||[]).reduce((s,it)=>s+itemCost(it)*(+it.qty||0),0);}
function orderPieces(o){return (o.items||[]).reduce((s,it)=>s+(+it.qty||0),0);}
function balance(o){return orderTotal(o)-(o.paid?orderTotal(o):(+o.deposit||0));}

/* ─────────── Render root ─────────── */
const root=()=>document.getElementById("root");
function renderApp(){
  if(LIVE && !session){ renderLogin(); return; }
  const r=root();
  r.innerHTML = topbar() + `<main><div class="wrap" id="view"></div></main>`;
  drawSpiral();
  document.getElementById("view").innerHTML = viewHtml();
  wireTop(); wireView(); showActiveTab();
}
function topbar(){
  const tabs=[["board","Board"],["orders","Orders"],["customers","Customers"],["inventory","Inventory"],["reports","Reports"],["pricing","Pricing"]];
  return `<header class="bar"><div class="wrap">
    <div class="brand"><canvas id="spiral" width="76" height="76"></canvas>
      <div><div class="est">Est. handmade</div><div class="word">Hippy <em>List</em></div></div></div>
    <nav class="tabs" role="tablist">${tabs.map(([k,l])=>`<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab===k}">${l}</button>`).join("")}</nav>
    <div class="right"><button class="btn berry sm" id="newBtn">+ New order</button><button class="icon-btn" id="setBtn" title="Settings" aria-label="Settings">⚙</button></div>
  </div></header>`;
}
function viewHtml(){
  if(tab==="board")return renderBoard();
  if(tab==="orders")return renderOrders();
  if(tab==="new")return renderBuilder();
  if(tab==="customers")return renderCustomers();
  if(tab==="inventory")return renderInventory();
  if(tab==="reports"||tab==="money")return renderReports();
  if(tab==="pricing")return renderPricing();
  if(tab==="settings")return renderSettings();
  return "";
}
function rerender(){ const v=document.getElementById("view"); if(v){ v.innerHTML=viewHtml(); wireView(); } document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-selected",t.dataset.tab===tab)); }

/* ─────────── Board ─────────── */
function renderBoard(){
  const open=S.orders.filter(o=>o.status!=="delivered");
  const booked=open.reduce((s,o)=>s+orderTotal(o),0);
  const outstanding=open.reduce((s,o)=>s+balance(o),0);
  const pieces=open.reduce((s,o)=>s+orderPieces(o),0);
  const q=search.trim().toLowerCase();
  const shown=q?S.orders.filter(o=>mOrder(o,q)):S.orders;
  let h="";
  if(!LIVE) h+=`<div class="banner warn"><b>Demo mode.</b> Running on this device with sample data. Connect Supabase (config.js) to go live and sync.</div>`;
  h+=`<div class="stats">
    <div class="stat"><div class="n tnum">${open.length}</div><div class="l">Open orders</div></div>
    <div class="stat"><div class="n tnum">${pieces}</div><div class="l">Pieces to dye</div></div>
    <div class="stat"><div class="n berry tnum">${money(booked)}</div><div class="l">Booked value</div></div>
    <div class="stat"><div class="n tnum">${money(outstanding)}</div><div class="l">Outstanding</div></div></div>`;
  h+=`<div class="toolbar"><div class="search">${searchIco()}<input id="search" value="${esc(search)}" placeholder="Search orders, customers, #"></div></div>`;
  h+=`<div class="board">`;
  STAGES.forEach(s=>{
    const inSt=shown.filter(o=>o.status===s.key).sort((a,b)=>(rushOn(b)-rushOn(a))||(dueKey(a)-dueKey(b)));
    h+=`<section class="col"><div class="colhead"><span class="dot" style="background:${s.hex}"></span><span class="colname">${s.label}</span><span class="n tnum">${inSt.length}</span></div>
      <div class="col-body">${inSt.length?inSt.map(o=>boardCard(o,s)).join(""):`<div class="col-empty">—</div>`}</div></section>`;
  });
  return h+`</div>`;
}
function boardCard(o,s){
  const dc=dueClass(o.customer&&o.customer.due), idx=stageIdx(o.status);
  const prog = o.status==="dyeing"?`<div class="bars"><i style="background:${s.hex}"></i><i style="background:${s.hex}"></i><i></i><i></i></div>`:"";
  return `<article class="ocard${rushOn(o)?" rush":""}" tabindex="0" role="button" data-open="${o.id}">
    <div class="oc-top"><span class="cust">${esc(o.customer&&o.customer.name||"Unnamed")}</span><span class="ref">HL-${o.ref||"—"}</span></div>
    ${rushOn(o)?`<div class="rush-tag">⚡ RUSH</div>`:""}
    ${o.customer&&o.customer.due?`<div class="oc-due ${dc}">Due ${fmtDue(o.customer.due)}</div>`:`<div class="oc-due">${orderPieces(o)} pieces</div>`}
    ${prog}
    <div class="oc-meta"><span>${o.items.map(it=>it.technique).slice(0,2).join(", ")}${o.paid?' · <span class="paid">Paid</span>':""}</span><span class="tot tnum">${money(orderTotal(o))}</span></div>
    <div class="mvb"><button data-mv="${o.id}" data-dir="-1" ${idx<=0?"disabled":""}>◀</button><button data-mv="${o.id}" data-dir="1" ${idx>=STAGES.length-1?"disabled":""}>▶</button></div>
  </article>`;
}

/* ─────────── Orders (list) ─────────── */
function renderOrders(){
  const q=search.trim().toLowerCase();
  const list=(q?S.orders.filter(o=>mOrder(o,q)):S.orders).slice();
  let h=`<div class="view-head"><h1>Orders</h1><div class="sub">${S.orders.length} total</div><div class="right"><button class="btn berry" id="newBtn2">+ New order</button></div></div>`;
  h+=`<div class="toolbar"><div class="search">${searchIco()}<input id="search" value="${esc(search)}" placeholder="Search customer or order #"></div></div>`;
  if(!list.length) return h+emptyState("No orders yet","Tap New order to add your first.");
  h+=`<div class="panel" style="padding:0"><div class="tablewrap"><table class="data"><thead><tr><th>Order</th><th>Customer</th><th>Stage</th><th>Pieces</th><th>Due</th><th style="text-align:right">Total</th><th style="text-align:right">Balance</th></tr></thead><tbody>`;
  list.forEach(o=>{const st=stageOf(o.status);h+=`<tr class="rowlink" data-open="${o.id}">
    <td><b class="tnum" style="color:var(--berry)">HL-${o.ref||"—"}</b></td>
    <td class="nm">${esc(o.customer&&o.customer.name||"Unnamed")}${rushOn(o)?' <span class="rush-tag sm">⚡ RUSH</span>':""}</td>
    <td><span class="badge" style="color:${st.hex}">● ${st.label}</span></td>
    <td class="tnum">${orderPieces(o)}</td>
    <td>${o.customer&&o.customer.due?`<span class="${dueClass(o.customer.due)==='over'?'low':''}">${fmtDue(o.customer.due)}</span>`:"—"}</td>
    <td class="tnum" style="text-align:right;font-weight:700">${money(orderTotal(o))}</td>
    <td class="tnum" style="text-align:right">${o.paid?'<span class="paid">Paid</span>':money(balance(o))}</td></tr>`;});
  return h+`</tbody></table></div></div>`;
}

/* ─────────── Builder (new / edit order) ─────────── */
function renderBuilder(){
  const t=draft,sub=orderSubtotal(t),chg=orderChargeLive(),rsh=rushOf(t),tax=taxOf(t,true),tot=sub+chg+rsh+tax,dep=+t.deposit||0,txOn=(+S.pricing.taxRate||0)>0;
  const names=[...new Set(S.orders.map(o=>o.customer&&o.customer.name).concat(S.customers.map(c=>c.name)).filter(Boolean))];
  return `<div class="view-head"><h1>${editId?"Edit order":"New order"}</h1><div class="sub">${editId?`HL-${(S.orders.find(o=>o.id===editId)||{}).ref||""}`:"Build it and it prices itself"}</div></div>
  <div class="builder"><div>
    <div class="panel"><h2>Customer</h2>
      <div class="grid2">
        <label class="fld">Name / crew<input class="inp" id="d-name" list="custlist" value="${esc(t.customer.name)}" placeholder="Who's this for?"></label>
        <datalist id="custlist">${names.map(n=>`<option value="${esc(n)}">`).join("")}</datalist>
        <label class="fld">Phone<input class="inp" id="d-phone" type="tel" value="${esc(t.customer.phone)}" placeholder="For texting invoices"></label>
        <label class="fld">Email<input class="inp" id="d-email" type="email" value="${esc(t.customer.email)}" placeholder="For emailing invoices"></label>
        <label class="fld">Needed by<input class="inp" id="d-due" type="date" value="${esc(t.customer.due)}"></label>
        <label class="fld">Type<select class="inp" id="d-kind"><option value="retail" ${t.customer.kind==="retail"?"selected":""}>Retail</option><option value="wholesale" ${t.customer.kind==="wholesale"?"selected":""}>Wholesale</option></select></label>
      </div></div>
    <div class="panel"><h2>Line items</h2><div id="items">${t.items.map((it,i)=>lineItem(it,i)).join("")}</div>
      <button class="btn sm" id="addItem">+ Add a piece</button></div>
    <div class="panel"><h2>Notes</h2><textarea class="inp" id="d-notes" placeholder="Pattern notes, packaging, color swaps…">${esc(t.notes)}</textarea></div>
  </div>
  <div class="side"><div class="invoice">
    <div class="dr-sec-t">Order total</div>
    <label class="rush-toggle"><input type="checkbox" id="d-rush" ${t.customer.rush?"checked":""}><span><b>⚡ Rush order</b><small id="rush-lbl">${rushLabel()} · set in Pricing</small></span></label>
    <div class="inv-row"><span>Subtotal · <span class="tnum" id="sum-pc">${orderPieces(t)}</span> pc</span><b class="tnum" id="sum-sub">${money(sub)}</b></div>
    <div class="inv-row" id="sum-chg-row" style="${chg>0?"":"display:none"}"><span>Order charge</span><b class="tnum" id="sum-chg">${money(chg)}</b></div>
    <div class="inv-row" id="sum-rush-row" style="${rsh>0?"":"display:none"}"><span>Rush fee</span><b class="tnum" id="sum-rush">${money(rsh)}</b></div>
    ${txOn?`<div class="inv-row"><span>Sales tax <span id="tax-note">${taxExempt(t)?"· exempt":`· ${S.pricing.taxRate}%`}</span></span><b class="tnum" id="sum-tax">${money(tax)}</b></div><label class="tax-ex"><input type="checkbox" id="d-taxex" ${taxExempt(t)?"checked":""}> Tax exempt <small>(wholesale / resale certificate)</small></label>`:""}
    <div class="inv-row total"><span>Total</span><span class="big tnum" id="sum-tot">${money(tot)}</span></div>
    <div class="inv-dep"><span style="font-size:13px;color:var(--muted)">Deposit $</span><input class="tnum" id="d-dep" type="number" min="0" step="1" value="${t.deposit||""}" placeholder="0"></div>
    <div class="inv-row"><span>Balance due</span><b class="tnum" id="sum-bal">${money(tot-dep)}</b></div>
    <div class="save-row"><button class="btn berry block" id="saveOrder">${editId?"Update order":"Save order"}</button></div>
    <button class="btn ghost block sm" id="clearDraft" style="margin-top:8px">${editId?"Cancel":"Clear"}</button>
  </div></div></div>`;
}
function lineItem(it,i){
  const sug=suggestP(it),manual=!(it.price===""||it.price==null);
  return `<div class="lineitem" data-i="${i}">
    <div class="li-grid">
      <label class="fld">Garment<select class="inp" data-f="garment" data-i="${i}">${S.pricing.blanks.map(b=>{const inv=S.inventory.find(i=>i.kind==="blank"&&i.name===b.name);return `<option value="${esc(b.name)}" ${b.name===it.garment?"selected":""}>${esc(b.name)}${inv?` · ${+inv.on_hand||0} in stock`:""}</option>`;}).join("")}</select></label>
      <label class="fld">Technique<select class="inp" data-f="technique" data-i="${i}">${S.pricing.techniques.map(x=>`<option ${x.name===it.technique?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
      <label class="fld">Qty<input class="inp tnum" type="number" min="1" step="1" data-f="qty" data-i="${i}" value="${it.qty}"></label>
    </div>
    <div class="li-grid2">
      <label class="fld">Size<select class="inp" data-f="size" data-i="${i}">${SIZES.map(s=>`<option ${s===it.size?"selected":""}>${s}</option>`).join("")}</select></label>
      <label class="fld">Color scheme<select class="inp" data-f="palette" data-i="${i}">${PALETTES.map(p=>`<option ${p===it.palette?"selected":""}>${esc(p)}</option>`).join("")}</select></label>
      <label class="fld"># colors<input class="inp tnum" type="number" min="1" max="12" step="1" data-f="colors" data-i="${i}" value="${it.colors}"></label>
    </div>
    <div class="li-foot"><button class="linkbtn" data-bd="${i}">price math</button>
      ${draft.items.length>1?`<button class="btn sm ghost danger" data-rm="${i}">Remove</button>`:""}
      <div class="li-price"><small>${manual?"your $":"sugg."}</small>$<input class="tnum" type="number" min="0" step="0.5" data-f="price" data-i="${i}" value="${manual?it.price:""}" placeholder="${sug}"></div></div>
    <div class="breakdown" id="bd-${i}">${priceMath(it)}</div></div>`;
}
function priceMath(it){
  const bc=blankCost(it.garment),tm=techMin(it.technique),lr=+S.pricing.laborRate||0;
  const labor=(tm/60)*lr,pp=matSum("piece"),pc=(+it.colors||0)*matSum("color");
  return `blank ${money(bc)} + labor ${money(labor)} (${tm}min @ ${money(lr)}/hr) + materials ${money(pp)} + dye ${money(pc)} (${+it.colors||0} colors)\n= cost ${money(itemCost(it))} × ${S.pricing.markup} markup → ${money(suggestP(it))}/pc`;
}

/* ─────────── Customers ─────────── */
function custAgg(){
  const map={};
  S.customers.forEach(c=>{ map[c.name]={name:c.name,phone:c.phone,email:c.email,kind:c.kind||"retail",notes:c.notes,id:c.id,orders:0,spent:0,last:null}; });
  S.orders.forEach(o=>{ const n=o.customer&&o.customer.name; if(!n)return; if(!map[n])map[n]={name:n,phone:o.customer.phone,email:o.customer.email,kind:o.customer.kind||"retail",orders:0,spent:0,last:null}; const m=map[n]; m.orders++; m.spent+=orderTotal(o); if(!m.last||o.createdAt>m.last)m.last=o.createdAt; if(!m.phone)m.phone=o.customer.phone; if(!m.email)m.email=o.customer.email; });
  return Object.values(map).sort((a,b)=>b.spent-a.spent);
}
function initials(n){return String(n||"?").trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join("").toUpperCase()||"?";}
const ICO={phone:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>`,mail:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,chat:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>`};
function renderCustomers(){
  const q=search.trim().toLowerCase();
  let list=custAgg(); if(q) list=list.filter(c=>c.name.toLowerCase().includes(q)||(c.phone||"").includes(q)||(c.email||"").toLowerCase().includes(q));
  let h=`<div class="view-head"><h1>Customers</h1><div class="sub">${list.length} total</div></div>`;
  h+=`<div class="toolbar"><div class="search">${searchIco()}<input id="search" value="${esc(search)}" placeholder="Search name, phone or email"></div></div>`;
  if(!list.length) return h+emptyState("No customers yet","They appear here as you take orders.");
  h+=`<div class="clist">${list.map(c=>`<div class="ccard" tabindex="0" role="button" data-cust="${esc(c.name)}">
    <div class="cav">${esc(initials(c.name))}</div>
    <div class="cmain"><div class="cname"><span>${esc(c.name)}</span><span class="badge ${c.kind==="wholesale"?"whole":""}">${c.kind}</span></div>
      <div class="ccontact">${c.phone?`<span>${ICO.phone}${esc(c.phone)}</span>`:""}${c.email?`<span>${ICO.mail}${esc(c.email)}</span>`:""}${!c.phone&&!c.email?`<span class="none">No contact on file</span>`:""}</div></div>
    <div class="cnums"><b class="tnum">${money(c.spent)}</b><small>${c.orders} order${c.orders===1?"":"s"}${c.last?` · ${fmtShort(c.last)}`:""}</small></div>
  </div>`).join("")}</div>`;
  return h;
}

/* ─────────── Inventory ─────────── */
function renderInventory(){
  const low=S.inventory.filter(x=>(+x.on_hand||0)<=(+x.reorder_at||0)&&(+x.reorder_at||0)>0);
  const del=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  let h=`<div class="pricing-wrap"><div class="view-head"><h1>Inventory</h1><div class="sub">${S.inventory.length} item${S.inventory.length===1?"":"s"}${low.length?` · <span class="low">${low.length} low</span>`:""}</div></div>`;
  h+=`<div id="invLow">${lowBanner(low)}</div>`;
  [["blank","Blanks","+ Add blank"],["material","Dyes & materials","+ Add dye / material"]].forEach(([kind,title,addL])=>{
    const items=S.inventory.filter(x=>x.kind===kind);
    h+=`<div class="panel"><h2>${title}</h2><div class="plist">${items.map(x=>{const lw=(+x.on_hand||0)<=(+x.reorder_at||0)&&(+x.reorder_at||0)>0;return `<div class="icard${lw?" is-low":""}" data-inv="${x.id}">
      <div class="mtop"><input class="pname" data-ifield="name" value="${esc(x.name)}" aria-label="Item name" enterkeyhint="next"><button class="pdel" data-invrm="${x.id}" aria-label="Remove ${esc(x.name)}">${del}</button></div>
      <div class="ibot">
        <div class="istep"><button type="button" data-adj="-1" aria-label="One less">−</button><input data-ifield="on_hand" type="number" inputmode="numeric" pattern="[0-9]*" min="0" value="${+x.on_hand||0}" aria-label="On hand" enterkeyhint="done"><button type="button" data-adj="1" aria-label="One more">+</button></div>
        <input class="iunit" data-ifield="unit" value="${esc(x.unit||"ea")}" aria-label="Unit">
        <label class="pnum ire"><span>reorder at</span><input data-ifield="reorder_at" type="number" inputmode="numeric" pattern="[0-9]*" min="0" value="${+x.reorder_at||0}"></label>
        <span class="lowtag">Low</span>
      </div></div>`;}).join("")}</div>
      <button class="padd" data-invadd="${kind}">${addL}</button></div>`;
  });
  return h+`</div>`;
}
function lowBanner(low){return low.length?`<div class="banner warn"><b>${low.length} item${low.length>1?"s":""} low:</b> ${low.map(x=>esc(x.name)).join(", ")}. Time to reorder.</div>`:"";}


/* ─────────── Reports ─────────── */
let rptRange="month";
const RANGES=[["month","This month"],["last","Last month"],["90","Last 90 days"],["year","This year"],["all","All time"]];
function rangeBounds(k){const n=new Date();let a=null,b=null;
  if(k==="month")a=new Date(n.getFullYear(),n.getMonth(),1);
  else if(k==="last"){a=new Date(n.getFullYear(),n.getMonth()-1,1);b=new Date(n.getFullYear(),n.getMonth(),1);}
  else if(k==="90")a=new Date(n.getTime()-90*864e5);
  else if(k==="year")a=new Date(n.getFullYear(),0,1);
  return {a,b};}
function inRange(o,r){const t=Date.parse(o.createdAt||"");if(isNaN(t))return !r.a;return (!r.a||t>=r.a.getTime())&&(!r.b||t<r.b.getTime());}
function collectedOf(o){const t=orderTotal(o);return o.paid?t:Math.min(t,+o.deposit||0);}
function costParts(o){let blank=0,labor=0,mat=0,dye=0;(o.items||[]).forEach(it=>{const q=+it.qty||0;blank+=blankCost(it.garment)*q;labor+=(techMin(it.technique)/60)*(+S.pricing.laborRate||0)*q;mat+=matSum("piece")*q;dye+=(+it.colors||0)*matSum("color")*q;});return {blank,labor,mat,dye};}
function pct(a,b){return b>0?Math.round(a/b*100):0;}
function groupBy(list,keyFn){const m={};list.forEach(o=>(o.items||[]).forEach(it=>{const k=keyFn(it)||"—";if(!m[k])m[k]={name:k,pieces:0,sales:0};const q=+it.qty||0;m[k].pieces+=q;m[k].sales+=itemUnit(it)*q;}));return Object.values(m).sort((a,b)=>b.sales-a.sales);}
function hrow(label,val,share,opt){opt=opt||{};return `<div class="hrow"${opt.open?` data-open="${opt.open}"`:""}${opt.cust?` data-cust="${esc(opt.cust)}"`:""} title="${esc(label)}: ${money(val)}${share!=null?` (${share}%)`:""}"><div class="hl"><span class="hn">${opt.dot?`<i class="dot" style="background:${opt.dot}"></i>`:""}${esc(label)}</span>${opt.sub?`<small>${esc(opt.sub)}</small>`:""}</div><div class="htrack"><div class="hfill" style="width:${Math.max(share||0,share>0?2:0)}%;${opt.color?`background:${opt.color}`:""}"></div></div><div class="hv tnum">${money(val)}${share!=null?`<small>${share}%</small>`:""}</div></div>`;}
function renderReports(){
  const r=rangeBounds(rptRange), list=S.orders.filter(o=>inRange(o,r)), rl=(RANGES.find(x=>x[0]===rptRange)||[])[1]||"";
  const sales=list.reduce((s,o)=>s+orderTotal(o),0), coll=list.reduce((s,o)=>s+collectedOf(o),0), owed=sales-coll;
  const tax=list.reduce((s,o)=>s+taxOf(o),0), taxColl=list.reduce((s,o)=>{const t=taxOf(o);if(!t)return s;const tot=orderTotal(o);return s+(o.paid?t:t*Math.min(1,(+o.deposit||0)/tot));},0);
  const cp=list.reduce((a,o)=>{const c=costParts(o);a.blank+=c.blank;a.labor+=c.labor;a.mat+=c.mat;a.dye+=c.dye;return a;},{blank:0,labor:0,mat:0,dye:0});
  const cost=cp.blank+cp.labor+cp.mat+cp.dye, profit=sales-tax-cost, pieces=list.reduce((s,o)=>s+orderPieces(o),0);
  const rushN=list.filter(o=>rushOn(o)).length, rushFees=list.reduce((s,o)=>s+rushOf(o),0);
  const ret=list.filter(o=>(o.customer||{}).kind!=="wholesale"), whl=list.filter(o=>(o.customer||{}).kind==="wholesale");
  const retS=ret.reduce((s,o)=>s+orderTotal(o),0), whlS=whl.reduce((s,o)=>s+orderTotal(o),0);
  let h=`<div class="view-head"><h1>Reports</h1><div class="sub">${esc(rl)} · ${list.length} order${list.length===1?"":"s"}</div><div class="right"><button class="btn sm" id="exportReport">Export CSV</button></div></div>`;
  h+=`<div class="seg rpt-range" role="tablist">${RANGES.map(([k,l])=>`<button data-rng="${k}" aria-pressed="${k===rptRange}">${l}</button>`).join("")}</div>`;
  h+=`<div class="money-cards">
    <div class="mcard"><div class="l">Sales</div><div class="v berry tnum">${money(sales)}</div><div class="s">${list.length} orders booked</div></div>
    <div class="mcard"><div class="l">Collected</div><div class="v good tnum">${money(coll)}</div><div class="s">${pct(coll,sales)}% of sales in hand</div></div>
    <div class="mcard"><div class="l">Still owed</div><div class="v tnum">${money(owed)}</div><div class="s">on these orders</div></div>
    <div class="mcard"><div class="l">Est. profit</div><div class="v tnum">${money(profit)}</div><div class="s">${pct(profit,sales-tax)}% margin · after costs${tax>0?" & tax":""}</div></div>
    <div class="mcard"><div class="l">Pieces</div><div class="v tnum">${pieces}</div><div class="s">${list.length?`${(pieces/list.length).toFixed(1)} per order`:"—"}</div></div>
    <div class="mcard"><div class="l">Avg order</div><div class="v tnum">${money(list.length?sales/list.length:0)}</div><div class="s">${pieces?`${money(sales/pieces)} per piece`:"—"}</div></div>
    <div class="mcard"><div class="l">Rush</div><div class="v tnum">${money(rushFees)}</div><div class="s">${rushN} rush order${rushN===1?"":"s"}</div></div>
    <div class="mcard"><div class="l">Sales tax</div><div class="v tnum">${money(taxColl)}</div><div class="s">${tax>0?"collected · owed to the state":"not charging tax yet"}</div></div></div>`;
  if(!list.length){ h+=emptyState("No orders in this range","Pick a wider range above."); return h+owedPanel()+pipelinePanel(); }
  // sales over time
  let buckets=[];
  if(rptRange==="month"||rptRange==="last"){const a=r.a,end=r.b||new Date(a.getFullYear(),a.getMonth()+1,1);for(let d=new Date(a);d<end;d.setDate(d.getDate()+7)){const s=new Date(d),e=new Date(Math.min(d.getTime()+7*864e5,end.getTime()));buckets.push({label:`${s.getMonth()+1}/${s.getDate()}`,a:s.getTime(),b:e.getTime(),v:0});}}
  else{const n=new Date(),count=rptRange==="90"?3:rptRange==="year"?n.getMonth()+1:12;for(let i=count-1;i>=0;i--){const s=new Date(n.getFullYear(),n.getMonth()-i,1),e=new Date(n.getFullYear(),n.getMonth()-i+1,1);buckets.push({label:s.toLocaleDateString("en-US",{month:"short"}),a:s.getTime(),b:e.getTime(),v:0});}}
  list.forEach(o=>{const t=Date.parse(o.createdAt||"");const bk=buckets.find(x=>t>=x.a&&t<x.b);if(bk)bk.v+=orderTotal(o);});
  const mx=Math.max(1,...buckets.map(b=>b.v));
  h+=`<div class="panel"><h2>Sales over time <small class="h2s">${rptRange==="month"||rptRange==="last"?"by week":"by month"}</small></h2><div class="barchart">${buckets.map(b=>`<div class="bg" title="${b.label}: ${money(b.v)}"><div class="bv tnum">${b.v?money(b.v):""}</div><div class="bar" style="height:${Math.round(b.v/mx*140)}px"></div><div class="bl">${b.label}</div></div>`).join("")}</div></div>`;
  // where the money goes
  const parts=[["Blanks",cp.blank,"Garments you dye on"],["Your labor",cp.labor,`Dye time × $${S.pricing.laborRate}/hr`],["Dyes",cp.dye,"Per dye color"],["Materials",cp.mat,"Soda ash, bottles, bags…"]];
  if(tax>0) parts.push(["Sales tax",tax,"Goes to the state"]);
  h+=`<div class="panel"><h2>Where the money goes <small class="h2s">of ${money(sales)} in sales</small></h2>${parts.map(([l,v,s])=>hrow(l,v,pct(v,sales),{sub:s})).join("")}${hrow("Profit",profit,pct(profit,sales),{sub:"What's left for you",color:"var(--good)"})}<div class="hint">Costs use your current Pricing numbers. Labor is your own time — if you're the one dyeing, that part is yours too.</div></div>`;
  // by technique / garment
  const tech=groupBy(list,it=>it.technique), garm=groupBy(list,it=>it.garment), pal=groupBy(list,it=>it.palette);
  const tbl=(title,rows)=>`<div class="panel"><h2>${title}</h2>${rows.slice(0,8).map(x=>hrow(x.name,x.sales,pct(x.sales,sales),{sub:`${x.pieces} piece${x.pieces===1?"":"s"}`})).join("")}</div>`;
  h+=`<div class="rgrid">${tbl("By technique",tech)}${tbl("By garment",garm)}</div>`;
  // customers + mix
  const cm={};list.forEach(o=>{const n=(o.customer||{}).name||"Unnamed";if(!cm[n])cm[n]={name:n,kind:(o.customer||{}).kind||"retail",orders:0,sales:0,owed:0};cm[n].orders++;cm[n].sales+=orderTotal(o);cm[n].owed+=balance(o);});
  const cust=Object.values(cm).sort((a,b)=>b.sales-a.sales);
  h+=`<div class="rgrid"><div class="panel"><h2>Top customers</h2>${cust.slice(0,8).map(c=>hrow(c.name,c.sales,pct(c.sales,sales),{sub:`${c.orders} order${c.orders===1?"":"s"}${c.owed>0.005?` · owes ${money(c.owed)}`:""}`,cust:c.name})).join("")}</div>
    <div class="panel"><h2>Sales mix</h2>${hrow("Retail",retS,pct(retS,sales),{sub:`${ret.length} orders`})}${hrow("Wholesale",whlS,pct(whlS,sales),{sub:`${whl.length} orders`})}<div class="mix-sep"></div>${pal.slice(0,5).map(x=>hrow(x.name,x.sales,pct(x.sales,sales),{sub:`${x.pieces} pcs · color scheme`})).join("")}</div></div>`;
  return h+owedPanel()+pipelinePanel();
}
function owedPanel(){
  const now=Date.now(), rows=S.orders.filter(o=>balance(o)>0.005).sort((a,b)=>Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0));
  const tot=rows.reduce((s,o)=>s+balance(o),0);
  if(!rows.length) return `<div class="panel"><h2>Who owes you</h2><div class="muted">Nobody — every order is paid up. ✌</div></div>`;
  return `<div class="panel" style="padding:0"><div style="padding:16px 18px 0"><h2 style="margin:0">Who owes you <small class="h2s">${money(tot)} across ${rows.length} order${rows.length===1?"":"s"} · all time</small></h2></div><div class="tablewrap"><table class="data"><thead><tr><th>Order</th><th>Customer</th><th class="hide-sm">Stage</th><th>Age</th><th class="hide-sm" style="text-align:right">Total</th><th class="hide-sm" style="text-align:right">Paid</th><th style="text-align:right">Balance</th></tr></thead><tbody>${rows.map(o=>{const age=Math.max(0,Math.floor((now-Date.parse(o.createdAt||now))/864e5)),st=stageOf(o.status);return `<tr class="rowlink" data-open="${o.id}"><td><b class="tnum" style="color:var(--berry)">HL-${o.ref||"—"}</b></td><td class="nm">${esc((o.customer||{}).name||"Unnamed")}</td><td class="hide-sm"><span class="badge" style="color:${st.hex}">● ${st.label}</span></td><td class="tnum ${age>30?"low":""}">${age}d</td><td class="hide-sm tnum" style="text-align:right">${money(orderTotal(o))}</td><td class="hide-sm tnum" style="text-align:right">${money(collectedOf(o))}</td><td class="tnum" style="text-align:right;font-weight:700">${money(balance(o))}</td></tr>`;}).join("")}</tbody></table></div></div>`;
}
function pipelinePanel(){
  const open=S.orders.filter(o=>o.status!=="delivered"), tot=open.reduce((s,o)=>s+orderTotal(o),0);
  return `<div class="panel"><h2>In the pipeline <small class="h2s">${money(tot)} in open orders · all time</small></h2>${STAGES.filter(s=>s.key!=="delivered").map(s=>{const os=open.filter(o=>o.status===s.key),v=os.reduce((a,o)=>a+orderTotal(o),0);return hrow(s.label,v,pct(v,tot),{sub:`${os.length} order${os.length===1?"":"s"} · ${os.reduce((a,o)=>a+orderPieces(o),0)} pcs`,dot:s.hex,color:s.hex});}).join("")}</div>`;
}
function exportReport(){const r=rangeBounds(rptRange),list=S.orders.filter(o=>inRange(o,r));const rows=[["Order","Date","Customer","Type","Stage","Pieces","Rush fee","Sales tax","Total","Collected","Balance","Blank cost","Labor","Dyes","Materials","Est. profit"]];list.forEach(o=>{const c=costParts(o),t=orderTotal(o),tx=taxOf(o);rows.push([`HL-${o.ref||""}`,(o.createdAt||"").slice(0,10),(o.customer||{}).name||"",(o.customer||{}).kind||"",stageOf(o.status).label,orderPieces(o),rushOf(o).toFixed(2),tx.toFixed(2),t.toFixed(2),collectedOf(o).toFixed(2),balance(o).toFixed(2),c.blank.toFixed(2),c.labor.toFixed(2),c.dye.toFixed(2),c.mat.toFixed(2),(t-tx-c.blank-c.labor-c.dye-c.mat).toFixed(2)]);});downloadFile(`hippy-report-${rptRange}.csv`,rows.map(x=>x.map(csv).join(",")).join("\n"));toast("Exported");}

/* ─────────── Pricing ─────────── */
let prDirty=false, pcBlank=0, pcTech=0, pcColors=3;
function renderPricing(){
  const p=S.pricing, B=p.blanks, T=p.techniques, M=p.materials||[];
  const pcB=B[Math.min(pcBlank,B.length-1)]||{name:""}, pcT=T[Math.min(pcTech,T.length-1)]||{name:""};
  const del=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const numIn=(attrs,val,pre,suf,step)=>`<label class="pnum">${pre?`<span>${pre}</span>`:""}<input ${attrs} type="number" inputmode="decimal" min="0" step="${step||"any"}" value="${val}">${suf?`<span>${suf}</span>`:""}</label>`;
  const seg=(attr,cur,opts)=>`<div class="pseg">${opts.map(([v,l])=>`<button type="button" ${attr} data-v="${v}" aria-pressed="${cur===v}">${l}</button>`).join("")}</div>`;
  let h=`<div class="pricing-wrap"><div class="view-head"><h1>Pricing</h1><div class="sub">Your costs → every order prices itself</div></div>`;
  // live price check
  h+=`<div class="panel pcheck"><h2>Price check</h2>
    <div class="pc-pick"><select id="pc-b">${B.map((x,i)=>`<option value="${i}" ${x===pcB?"selected":""}>${esc(x.name)}</option>`).join("")}</select><select id="pc-t">${T.map((x,i)=>`<option value="${i}" ${x===pcT?"selected":""}>${esc(x.name)}</option>`).join("")}</select><label class="pnum sm"><input id="pc-c" type="number" inputmode="numeric" min="1" max="12" value="${pcColors}"><span>colors</span></label></div>
    <div id="pc-out">${priceCheckHtml(pcB.name,pcT.name,pcColors)}</div></div>`;
  // rates
  h+=`<div class="panel"><h2>Your rates</h2>
    <div class="pfield"><div><b>Labor rate</b><small>What your dye time is worth</small></div>${numIn('id="s-labor"',p.laborRate,"$","/hr","1")}</div>
    <div class="pfield"><div><b>Markup</b><small>Price = cost × this (2.2 = 120% on top)</small></div>${numIn('id="s-markup"',p.markup,"","×","0.1")}</div>
    <div class="pfield"><div><b>Round prices up to</b><small>Nearest $0.50, $1…</small></div>${numIn('id="s-round"',p.roundTo,"$","","0.25")}</div></div>`;
  // blanks
  h+=`${(()=>{const n=B.filter(x=>!(+x.cost>0)).length+M.filter(x=>!(+x.cost>0)).length;return n?`<div class="banner warn"><b>${n} item${n>1?"s":""} need a cost.</b> Fill in the boxes outlined in gold so prices come out right.</div>`:"";})()}<div class="panel"><h2>Blanks <small class="h2s">what each garment costs you</small></h2><div class="plist">${B.map((x,i)=>`<div class="prow"><input class="pname" data-bt="name" data-bi="${i}" value="${esc(x.name)}" aria-label="Garment name">${numIn(`data-bt="cost" data-bi="${i}" aria-label="Cost"`,x.cost,"$","","0.25")}<button class="pdel" data-brm="${i}" aria-label="Remove ${esc(x.name)}">${del}</button></div>`).join("")}</div><button class="padd" id="addBlank">+ Add garment</button></div>`;
  // techniques
  h+=`<div class="panel"><h2>Techniques <small class="h2s">hands-on minutes per piece</small></h2><div class="plist">${T.map((x,i)=>`<div class="prow"><input class="pname" data-tt="name" data-ti="${i}" value="${esc(x.name)}" aria-label="Technique name">${numIn(`data-tt="min" data-ti="${i}" aria-label="Minutes"`,x.min,"","min","1")}<button class="pdel" data-trm="${i}" aria-label="Remove ${esc(x.name)}">${del}</button></div>`).join("")}</div><button class="padd" id="addTech">+ Add technique</button></div>`;
  // materials
  h+=`<div class="panel"><h2>Dyes & materials</h2><div class="plist">${M.map((m,i)=>`<div class="prow mat"><div class="mtop"><input class="pname" data-mt="name" data-mi="${i}" value="${esc(m.name)}" aria-label="Material name"><button class="pdel" data-mrm="${i}" aria-label="Remove ${esc(m.name)}">${del}</button></div><div class="mbot">${numIn(`data-mt="cost" data-mi="${i}" aria-label="Cost"`,m.cost,"$","","0.05")}<span class="per">per</span>${seg(`data-mper="${i}"`,m.per,[["piece","Piece"],["color","Color"],["order","Order"]])}</div></div>`).join("")}</div><button class="padd" id="addMat">+ Add dye / material</button><div class="hint">“Per color” is multiplied by the dye colors in each piece. “Per order” is added once per order.</div></div>`;
  // rush
  const r=p.rush||{type:"percent",amount:25};
  h+=`<div class="panel"><h2>Rush orders</h2>${seg('data-rtype=""',r.type,[["percent","% of order"],["flat","Flat fee"],["piece","Per piece"]])}<div class="pfield" style="margin-top:12px"><div><b>Rush charge</b><small>Added when “Rush order” is on</small></div>${numIn('id="s-rush-amt"',r.amount,r.type==="percent"?"":"$",r.type==="percent"?"%":r.type==="piece"?"/pc":"","1")}</div></div>`;
  // tax
  h+=`<div class="panel"><h2>Sales tax</h2><div class="pfield"><div><b>Tax rate</b><small>Leave at 0 until you have a vendor's license</small></div>${numIn('id="s-tax"',p.taxRate||0,"","%","0.05")}</div><div class="hint">Use your county's total rate. Tax covers the whole order (pieces, rush, order charges). Wholesale is exempt automatically.</div></div>`;
  h+=`<div class="psave${prDirty?" show":""}" id="psave"><span>Unsaved changes</span><button class="btn berry" id="savePricing">Save pricing</button></div><div class="psave-pad"></div></div>`;
  return h;
}
function priceCheckHtml(bn,tn,colors){
  const it={garment:bn,technique:tn,colors:+colors||0,qty:1,price:""};
  const bc=blankCost(bn),tm=techMin(tn),lr=+S.pricing.laborRate||0,labor=tm/60*lr,mat=matSum("piece"),dye=(+colors||0)*matSum("color"),cost=itemCost(it),sug=suggestP(it);
  return `<div class="pc-big"><span>Suggested price</span><b class="tnum">${money(sug)}</b><small>${money(sug-cost)} profit per piece</small></div>
    <div class="pc-rows"><div><span>Blank</span><b>${money(bc)}</b></div><div><span>Labor · ${tm} min</span><b>${money(labor)}</b></div><div><span>Materials</span><b>${money(mat)}</b></div><div><span>Dye · ${+colors||0} colors</span><b>${money(dye)}</b></div><div class="tot"><span>Your cost</span><b>${money(cost)}</b></div><div><span>× ${S.pricing.markup} markup, rounded</span><b>${money(sug)}</b></div></div>`;
}

/* ─────────── Settings ─────────── */
function renderSettings(){
  return `<div class="view-head"><h1>Settings</h1><div class="sub">Shop & account</div></div>
  <div class="panel"><h2>Shop</h2><div class="grid2">
    <label class="fld">Shop name<input class="inp" id="set-shop" value="${esc(S.settings.shop||"")}"></label>
    <label class="fld">Owner<input class="inp" id="set-owner" value="${esc(S.settings.owner||"")}"></label>
    <label class="fld">Shop phone / IG<input class="inp" id="set-contact" value="${esc(S.settings.contact||"")}" placeholder="Shows on invoices"></label>
    <label class="fld">Shop email<input class="inp" id="set-email" type="email" value="${esc(S.settings.email||"")}" placeholder="Shows on invoices"></label></div>
    <div class="save-row"><button class="btn berry" id="saveSettings">Save</button></div></div>
  <div class="panel"><h2>Invoices</h2>
    <label class="fld">How to pay you<textarea class="inp" id="set-pay" placeholder="Venmo @yourname · Cash App $yourname · Zelle (513) 555-0100">${esc(S.settings.payWith||"")}</textarea></label>
    <label class="fld" style="margin-top:12px">Note at the bottom<input class="inp" id="set-foot" value="${esc(S.settings.invoiceNote||"")}" placeholder="Thanks for supporting handmade ✌"></label>
    <div class="hint">Printed on every invoice you text, email or save as PDF.</div>
    <div class="save-row"><button class="btn berry" id="saveSettings2">Save</button></div></div>
  <div class="panel"><h2>Data</h2><div class="save-row">
    <button class="btn" id="exportOrders2">Export orders CSV</button>
    <button class="btn" id="exportCust">Export customers CSV</button></div>
    <div class="hint">Your data is yours — export anytime.</div></div>
  ${LIVE?`<div class="panel"><h2>Account</h2><div class="muted" style="margin-bottom:12px">Signed in${session&&session.user?` as ${esc(session.user.email||"")}`:""}.</div><div class="grid2"><label class="fld">Set password<input class="inp" id="set-pw" type="password" autocomplete="new-password" placeholder="At least 8 characters"></label><label class="fld">Type it again<input class="inp" id="set-pw2" type="password" autocomplete="new-password"></label></div><div class="hint">Lets you sign in from the home-screen app without an email link.</div><div class="save-row"><button class="btn berry" id="savePw">Save password</button><button class="btn danger" id="signout">Sign out</button></div></div>`:`<div class="panel"><h2>Account</h2><div class="muted">Running in local demo mode. Connect Supabase to enable accounts & sync.</div></div>`}`;
}

/* ─────────── Login ─────────── */
function renderLogin(){
  root().innerHTML=`<div class="login"><div class="login-card">
    <canvas id="spiral" width="112" height="112" style="width:56px;height:56px"></canvas>
    <div class="est">Est. handmade</div><div class="word">Hippy <em>List</em></div>
    <p>Sign in to your shop.</p>
    <input id="authEmail" type="email" placeholder="you@email.com" value="${esc(authEmail)}" autocomplete="username" inputmode="email">
    <input id="authPass" type="password" placeholder="Password" autocomplete="current-password">
    <button class="btn berry block" id="signIn">Sign in</button>
    <button class="linkbtn" id="sendLink" style="margin-top:14px">No password yet? Email me a sign-in link</button>
    <div class="hint" id="authMsg"></div>
  </div></div>`;
  drawSpiral();
  const inp=document.getElementById("authEmail"), pw=document.getElementById("authPass"), sbtn=document.getElementById("signIn"), lbtn=document.getElementById("sendLink"), msg=document.getElementById("authMsg");
  inp.oninput=()=>authEmail=inp.value;
  const net=m=>m.includes("fetch")||m.includes("network");
  const signIn=async()=>{ if(!authEmail.includes("@")){toast("Enter your email");return;} if(!pw.value){toast("Enter your password");return;}
    sbtn.disabled=true; sbtn.textContent="Signing in…"; msg.textContent="";
    try{ const {error}=await sb.auth.signInWithPassword({email:authEmail.trim(),password:pw.value});
      if(error){ const m=(error.message||"").toLowerCase(); msg.textContent=net(m)?"Couldn't reach the server — check your connection.":m.includes("invalid")?"Wrong email or password. No password yet? Use the link below.":"Couldn't sign in: "+error.message; }
    }catch(e){ msg.textContent="Couldn't reach the server — check your connection."; } sbtn.disabled=false; sbtn.textContent="Sign in"; };
  sbtn.onclick=signIn; pw.onkeydown=e=>{if(e.key==="Enter")signIn();}; inp.onkeydown=e=>{if(e.key==="Enter")pw.focus();};
  lbtn.onclick=async()=>{ if(!authEmail.includes("@")){toast("Enter your email first");return;} lbtn.disabled=true; msg.textContent="Sending…";
    try{ const {error}=await sb.auth.signInWithOtp({email:authEmail.trim(),options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}});
      if(error){ const m=(error.message||"").toLowerCase();
        msg.textContent=net(m)?"Couldn't reach the server — check your connection.":m.includes("rate")?"Too many links sent — wait about an hour, then try again.":(m.includes("signup")||m.includes("not found")||m.includes("not allowed"))?"That email isn't on this shop. Use the email you signed up with.":"Couldn't send: "+error.message; }
      else msg.textContent="Link sent. On iPhone it opens in Safari — sign in there, then go to Settings → Set password. After that, the home-screen app signs in with your password.";
    }catch(e){ msg.textContent="Couldn't reach the server — check your connection."; } lbtn.disabled=false; };
}

/* ─────────── Wiring ─────────── */
function wireTop(){
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;search="";rerender();showActiveTab();window.scrollTo(0,0);});
  const nb=document.getElementById("newBtn"); if(nb) nb.onclick=()=>{startNew();};
  const sb2=document.getElementById("setBtn"); if(sb2) sb2.onclick=()=>{tab="settings";renderApp();};
}
function showActiveTab(){const t=document.querySelector('.tab[aria-selected="true"]'),n=document.querySelector('nav.tabs');if(t&&n){const l=t.offsetLeft-n.offsetLeft,w=t.offsetWidth;if(l<n.scrollLeft||l+w>n.scrollLeft+n.clientWidth)n.scrollTo({left:Math.max(0,l-24),behavior:'smooth'});}}
function startNew(){ editId=null; draft=freshDraft(); tab="new"; renderApp(); }

function wireView(){
  const sb2=document.getElementById("search"); if(sb2) sb2.oninput=()=>{search=sb2.value; const v=document.getElementById("view"); v.innerHTML=viewHtml(); wireView(); const n=document.getElementById("search"); if(n){n.focus();const x=n.value;n.value="";n.value=x;}};
  document.querySelectorAll("[data-open]").forEach(el=>{el.onclick=()=>openOrder(el.dataset.open);el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openOrder(el.dataset.open);}};});
  document.querySelectorAll("[data-mv]").forEach(b=>b.onclick=e=>{e.stopPropagation();moveStage(b.dataset.mv,+b.dataset.dir);});
  document.querySelectorAll("[data-cust]").forEach(el=>{el.onclick=()=>openCustomer(el.dataset.cust);el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openCustomer(el.dataset.cust);}};});
  const nb2=document.getElementById("newBtn2"); if(nb2) nb2.onclick=startNew;

  if(tab==="new") wireBuilder();
  if(tab==="inventory") wireInventory();
  if(tab==="pricing") wirePricing();
  if(tab==="settings") wireSettings();
  if(tab==="reports"){ const e=document.getElementById("exportReport"); if(e) e.onclick=exportReport; document.querySelectorAll("[data-rng]").forEach(b=>b.onclick=()=>{rptRange=b.dataset.rng;rerender();}); }
}
function wireBuilder(){
  bind("d-name",v=>draft.customer.name=v); bind("d-phone",v=>draft.customer.phone=v); bind("d-email",v=>draft.customer.email=v);
  bind("d-due",v=>draft.customer.due=v); bind("d-kind",v=>draft.customer.kind=v); bind("d-notes",v=>draft.notes=v);
  const dep=document.getElementById("d-dep"); if(dep) dep.oninput=()=>{draft.deposit=num(dep.value);soft();};
  const rz=document.getElementById("d-rush"); if(rz) rz.onchange=()=>{draft.customer.rush=rz.checked;soft();};
  const tz=document.getElementById("d-taxex"); if(tz) tz.onchange=()=>{draft.customer.taxExempt=tz.checked;soft();};
  const kz=document.getElementById("d-kind"); if(kz) kz.addEventListener("change",()=>soft());
  document.querySelectorAll("#items [data-f]").forEach(el=>{const i=+el.dataset.i,f=el.dataset.f;el.addEventListener(el.tagName==="SELECT"?"change":"input",()=>{draft.items[i][f]=el.value;soft();});});
  document.querySelectorAll("[data-bd]").forEach(b=>b.onclick=()=>{const el=document.getElementById("bd-"+b.dataset.bd);el.classList.toggle("open");b.textContent=el.classList.contains("open")?"hide math":"price math";});
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{draft.items.splice(+b.dataset.rm,1);rerender();});
  const ai=document.getElementById("addItem"); if(ai) ai.onclick=()=>{draft.items.push(freshItem());rerender();};
  document.getElementById("saveOrder").onclick=saveOrder;
  document.getElementById("clearDraft").onclick=()=>{const w=!!editId;editId=null;draft=freshDraft();tab=w?"orders":"new";renderApp();};
}
function soft(){
  draft.items.forEach((it,i)=>{const row=document.querySelector(`.lineitem[data-i="${i}"]`);if(!row)return;const p=row.querySelector('[data-f="price"]');if(p)p.placeholder=String(suggestP(it));const bd=row.querySelector(".breakdown");if(bd)bd.textContent=priceMath(it);});
  const sub=orderSubtotal(draft),chg=orderChargeLive(),rsh=rushOf(draft),tax=taxOf(draft,true),tot=sub+chg+rsh+tax,dep=num(draft.deposit);
  setTxt("sum-tax",money(tax));setTxt("tax-note",taxExempt(draft)?"· exempt":`· ${S.pricing.taxRate}%`);const tx=document.getElementById("d-taxex");if(tx)tx.checked=taxExempt(draft);
  setTxt("sum-sub",money(sub));setTxt("sum-chg",money(chg));setTxt("sum-rush",money(rsh));const rr=document.getElementById("sum-rush-row");if(rr)rr.style.display=rsh>0?"":"none";setTxt("sum-tot",money(tot));setTxt("sum-bal",money(tot-dep));setTxt("sum-pc",orderPieces(draft));
  const cr=document.getElementById("sum-chg-row");if(cr)cr.style.display=chg>0?"":"none";
}
function wireInventory(){
  document.querySelectorAll(".icard").forEach(card=>{
    const id=card.dataset.inv, x=S.inventory.find(i=>i.id===id); if(!x) return;
    const qty=card.querySelector('[data-ifield="on_hand"]');
    const touch=()=>{const lw=(+x.on_hand||0)<=(+x.reorder_at||0)&&(+x.reorder_at||0)>0;card.classList.toggle("is-low",lw);const lowAll=S.inventory.filter(i=>(+i.on_hand||0)<=(+i.reorder_at||0)&&(+i.reorder_at||0)>0);const lb=document.getElementById("invLow");if(lb)lb.innerHTML=lowBanner(lowAll);};
    card.querySelectorAll("[data-ifield]").forEach(el=>{
      const f=el.dataset.ifield, isNum=el.type==="number";
      if(isNum){ el.addEventListener("focus",()=>{ if(el.value==="0") el.value=""; el.addEventListener("mouseup",e=>e.preventDefault(),{once:true}); setTimeout(()=>{try{el.select();}catch(e){}},0); }); el.addEventListener("blur",()=>{ if(el.value==="") el.value=x[f]||0; }); }
      el.oninput=()=>{x[f]=isNum?Math.max(0,Math.floor(num(el.value))):el.value;saveInvSoon(id,{[f]:x[f]});touch();};
      el.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();if(f==="name")qty.focus();else el.blur();}};
      if(f==="name"){ el.addEventListener("focus",()=>{el.dataset.old=x.name||"";}); el.addEventListener("change",()=>pricingFromInv(x.kind,el.dataset.old,el.value).then(()=>{el.dataset.old=x.name;})); }
    });
    card.querySelectorAll("[data-adj]").forEach(b=>b.onclick=()=>{x.on_hand=Math.max(0,(+x.on_hand||0)+(+b.dataset.adj));qty.value=x.on_hand;saveInvSoon(id,{on_hand:x.on_hand});touch();});
  });
  document.querySelectorAll("[data-invrm]").forEach(b=>b.onclick=()=>rmInv(b.dataset.invrm));
  document.querySelectorAll("[data-invadd]").forEach(b=>b.onclick=()=>addInv(b.dataset.invadd));
}
function wirePricing(){
  const dirty=()=>{prDirty=true;const b=document.getElementById("psave");if(b)b.classList.add("show");pcRefresh();};
  const pcRefresh=()=>{const o=document.getElementById("pc-out");if(!o)return;const B=S.pricing.blanks,T=S.pricing.techniques;o.innerHTML=priceCheckHtml((B[Math.min(pcBlank,B.length-1)]||{}).name,(T[Math.min(pcTech,T.length-1)]||{}).name,pcColors);};
  const n=(id,set)=>{const el=document.getElementById(id);if(el)el.oninput=()=>{set(num(el.value));dirty();};};
  n("s-labor",v=>S.pricing.laborRate=v);n("s-markup",v=>S.pricing.markup=v);n("s-round",v=>S.pricing.roundTo=v);n("s-tax",v=>S.pricing.taxRate=v);n("s-rush-amt",v=>S.pricing.rush.amount=v);
  document.querySelectorAll("[data-bt]").forEach(el=>el.oninput=()=>{const i=+el.dataset.bi,f=el.dataset.bt;S.pricing.blanks[i][f]=f==="cost"?num(el.value):el.value;dirty();});
  document.querySelectorAll("[data-tt]").forEach(el=>el.oninput=()=>{const i=+el.dataset.ti,f=el.dataset.tt;S.pricing.techniques[i][f]=f==="min"?num(el.value):el.value;dirty();});
  document.querySelectorAll("[data-mt]").forEach(el=>el.oninput=()=>{const i=+el.dataset.mi,f=el.dataset.mt;S.pricing.materials[i][f]=f==="cost"?num(el.value):el.value;dirty();});
  document.querySelectorAll("[data-mper]").forEach(b=>b.onclick=()=>{S.pricing.materials[+b.dataset.mper].per=b.dataset.v;b.parentNode.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));dirty();});
  document.querySelectorAll("[data-rtype]").forEach(b=>b.onclick=()=>{S.pricing.rush.type=b.dataset.v;prDirty=true;rerender();});
  const rm=(attr,arr,label)=>document.querySelectorAll(`[${attr}]`).forEach(b=>b.onclick=()=>{const i=+b.getAttribute(attr),list=S.pricing[arr];if(list.length<=1){toast(`Keep at least one ${label}`);return;}list.splice(i,1);prDirty=true;rerender();});
  rm("data-brm","blanks","garment");rm("data-trm","techniques","technique");
  document.querySelectorAll("[data-mrm]").forEach(b=>b.onclick=()=>{S.pricing.materials.splice(+b.dataset.mrm,1);prDirty=true;rerender();});
  const add=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=()=>{fn();prDirty=true;rerender();const b=document.getElementById("psave");if(b)b.classList.add("show");const fresh=document.getElementById(id);const ins=fresh?fresh.parentNode.querySelectorAll(".pname"):[];const last=ins[ins.length-1];if(last){last.focus();last.select();last.scrollIntoView({block:"center",behavior:"smooth"});}};};
  add("addBlank",()=>S.pricing.blanks.push({name:"New garment",cost:5}));
  add("addTech",()=>S.pricing.techniques.push({name:"New technique",min:5}));
  add("addMat",()=>S.pricing.materials.push({name:"New material",cost:0.25,per:"piece"}));
  const pb=document.getElementById("pc-b"),pt=document.getElementById("pc-t"),pc=document.getElementById("pc-c");
  if(pb)pb.onchange=()=>{pcBlank=+pb.value;pcRefresh();}; if(pt)pt.onchange=()=>{pcTech=+pt.value;pcRefresh();}; if(pc)pc.oninput=()=>{pcColors=Math.max(0,num(pc.value));pcRefresh();};
  document.getElementById("savePricing").onclick=async()=>{await savePricing();prDirty=false;const b=document.getElementById("psave");if(b)b.classList.remove("show");};
}
function wireSettings(){
  const saveSet=()=>{S.settings.shop=val("set-shop");S.settings.owner=val("set-owner");S.settings.contact=val("set-contact");S.settings.email=val("set-email");S.settings.payWith=val("set-pay");S.settings.invoiceNote=val("set-foot");savePricing("Saved");};
  ["saveSettings","saveSettings2"].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=saveSet;});
  const e1=document.getElementById("exportOrders2"); if(e1) e1.onclick=exportOrders;
  const e2=document.getElementById("exportCust"); if(e2) e2.onclick=exportCustomers;
  const so=document.getElementById("signout"); if(so) so.onclick=async()=>{await sb.auth.signOut();};
  const sp=document.getElementById("savePw"); if(sp) sp.onclick=async()=>{const a=val("set-pw"),b=val("set-pw2"); if(a.length<8){toast("Use at least 8 characters");return;} if(a!==b){toast("Passwords don't match");return;} sp.disabled=true; try{const {error}=await sb.auth.updateUser({password:a}); if(error){toast(/weak|short|least/i.test(error.message)?"Pick a longer password":"Couldn't save: "+error.message);} else {toast("Password saved ✌");document.getElementById("set-pw").value="";document.getElementById("set-pw2").value="";}}catch(e){toast("Couldn't reach the server");} sp.disabled=false;};
}

/* ─────────── Writes ─────────── */
async function saveOrder(){
  if(!draft.customer.name||!draft.customer.name.trim()){toast("Add a customer name");return;}
  const clean=draft.items.filter(it=>+it.qty>0); if(!clean.length){toast("Add at least one piece");return;}
  const items=clean.map(it=>({garment:it.garment,size:it.size,qty:+it.qty||0,technique:it.technique,palette:it.palette,colors:+it.colors||0,price:itemUnit(it)}));
  const cust={name:draft.customer.name.trim(),phone:draft.customer.phone||"",email:draft.customer.email||"",due:draft.customer.due||"",kind:draft.customer.kind||"retail"};
  if(draft.customer.rush){cust.rush=true;cust.rushFee=rushLive({items});}
  cust.taxExempt=taxExempt({customer:{...cust,taxExempt:draft.customer.taxExempt}}); cust.taxRate=+S.pricing.taxRate||0;
  if(editId){
    const ex=S.orders.find(o=>o.id===editId)||{};
    if(ex.customer&&ex.customer.invoicedAt) cust.invoicedAt=ex.customer.invoicedAt;
    const o={...ex,customer:cust,items,deposit:num(draft.deposit),notes:draft.notes||"",orderCharge:orderChargeLive()};
    await putOrder(o); editId=null; draft=freshDraft(); tab="orders"; renderApp(); toast("Order updated");
    return;
  }
  const o={id:uid(),ref:nextRef(),status:"new",customer:cust,items,deposit:num(draft.deposit),paid:false,photos:[],notes:draft.notes||"",orderCharge:orderChargeLive(),createdAt:new Date().toISOString()};
  await putOrder(o,true); await ensureCustomer(cust); draft=freshDraft(); tab="orders"; renderApp(); toast("Order saved ✌");
}
async function putOrder(o,isNew){
  if(LIVE){ if(isNew){const {data}=await sb.from("orders").insert(orderToRow(o)).select().single(); if(data){o.id=data.id;o.ref=data.ref;}} else {await sb.from("orders").update(orderToRow(o)).eq("id",o.id);} await refetch("orders"); }
  else { const i=S.orders.findIndex(x=>x.id===o.id); if(i>=0)S.orders[i]=o; else S.orders.unshift(o); saveLocal(); }
}
async function moveStage(id,dir){const o=S.orders.find(x=>x.id===id);if(!o)return;const ni=Math.min(STAGES.length-1,Math.max(0,stageIdx(o.status)+dir));o.status=STAGES[ni].key;if(LIVE){await sb.from("orders").update({status:o.status}).eq("id",id);}else saveLocal();rerender();if(openId)renderDrawer();}
async function changeStatus(id,status){const o=S.orders.find(x=>x.id===id);if(o)o.status=status;if(LIVE){await sb.from("orders").update({status}).eq("id",id);}else saveLocal();rerender();if(openId)renderDrawer();}
async function togglePaid(id){const o=S.orders.find(x=>x.id===id);if(!o)return;o.paid=!o.paid;const c={...o.customer};if(o.paid)c.paidAt=new Date().toISOString();else{delete c.paidAt;delete c.receiptAt;}o.customer=c;if(LIVE){await sb.from("orders").update({paid:o.paid,customer:c}).eq("id",id);}else saveLocal();rerender();renderDrawer();if(o.paid)toast("Marked paid — send them a receipt ✌");}
async function removeOrder(id){S.orders=S.orders.filter(x=>x.id!==id);if(LIVE){await sb.from("orders").delete().eq("id",id);}else saveLocal();rerender();toast("Order deleted");}
async function ensureCustomer(cust){
  if(S.customers.find(c=>c.name.toLowerCase()===cust.name.toLowerCase())) return;
  const rec={id:uid(),name:cust.name,phone:cust.phone||"",email:cust.email||"",kind:cust.kind||"retail",notes:""};
  if(LIVE){try{await sb.from("customers").insert({name:rec.name,phone:rec.phone,email:rec.email,kind:rec.kind});}catch(e){}} else {S.customers.push(rec);saveLocal();}
}
async function persistPricing(){ S.pricing.settings=S.settings; if(LIVE){const r=await sb.from("pricing").upsert({user_id:session.user.id,data:S.pricing});if(r.error)throw r.error;} else saveLocal(); }
async function savePricing(msg){ try{ await persistPricing(); }catch(e){ toast("Couldn't save"); return; } await syncInvFromPricing(); if(!LIVE) saveLocal(); toast(typeof msg==="string"?msg:"Pricing saved"); }
/* One list everywhere: Inventory blanks ↔ Pricing blanks ↔ order garment menu, Inventory materials ↔ Pricing materials. Matched by name. */
let prSnap={blank:{},material:{}};
function prList(kind){return kind==="material"?(S.pricing.materials||(S.pricing.materials=[])):S.pricing.blanks;}
function snapPricing(){prSnap={blank:{},material:{}};["blank","material"].forEach(k=>prList(k).forEach(x=>{prSnap[k][x.id]=x.name;}));}
async function invCreate(kind,name){ if(!name||S.inventory.some(i=>i.kind===kind&&i.name===name))return; const row={kind,name,on_hand:0,reorder_at:0,unit:kind==="blank"?"ea":"jars"}; if(LIVE){try{const {data}=await sb.from("inventory").insert(row).select().single();if(data&&!S.inventory.some(i=>i.id===data.id))S.inventory.push(data);}catch(e){}} else S.inventory.push({id:uid(),...row}); }
async function invRename(kind,oldN,newN){ const x=S.inventory.find(i=>i.kind===kind&&i.name===oldN); if(!x) return invCreate(kind,newN); x.name=newN; if(LIVE){try{await sb.from("inventory").update({name:newN}).eq("id",x.id);}catch(e){}} }
async function invDelete(kind,name){ const x=S.inventory.find(i=>i.kind===kind&&i.name===name); if(!x)return; S.inventory=S.inventory.filter(i=>i!==x); if(LIVE){try{await sb.from("inventory").delete().eq("id",x.id);}catch(e){}} }
async function syncInvFromPricing(){
  for(const k of ["blank","material"]){ const list=prList(k), seen=new Set();
    for(const x of list){ const nm=(x.name||"").trim(); seen.add(x.id); if(!nm) continue; const old=prSnap[k][x.id]; if(old===undefined) await invCreate(k,nm); else if(old!==nm) await invRename(k,old,nm); }
    for(const id of Object.keys(prSnap[k])) if(!seen.has(id)) await invDelete(k,prSnap[k][id]); }
  snapPricing();
}
async function reconcileLists(){
  let changed=false;
  for(const k of ["blank","material"]){ const list=prList(k);
    for(const i of S.inventory.filter(i=>i.kind===k&&(i.name||"").trim())) if(!list.some(x=>x.name===i.name)){ list.push(k==="blank"?{id:uid(),name:i.name,cost:0}:{id:uid(),name:i.name,cost:0,per:"piece"}); changed=true; }
    for(const x of list) if((x.name||"").trim()&&!S.inventory.some(i=>i.kind===k&&i.name===x.name)) await invCreate(k,x.name); }
  snapPricing(); if(changed){ try{ await persistPricing(); }catch(e){} } if(!LIVE) saveLocal();
}
async function pricingFromInv(kind,oldN,newN){ const list=prList(kind); newN=(newN||"").trim(); if(!newN) return;
  const hit=oldN?list.find(x=>x.name===oldN):null;
  if(hit) hit.name=newN; else if(!list.some(x=>x.name===newN)){ list.push(kind==="blank"?{id:uid(),name:newN,cost:0}:{id:uid(),name:newN,cost:0,per:"piece"}); toast(`Added “${newN}” to Pricing and orders — set its cost in Pricing`); }
  snapPricing(); try{ await persistPricing(); }catch(e){} }


/* inventory ops */
async function adjInv(id,d){const x=S.inventory.find(i=>i.id===id);if(!x)return;x.on_hand=Math.max(0,(+x.on_hand||0)+d);await setInv(id,{on_hand:x.on_hand});}
async function setInv(id,patch){const x=S.inventory.find(i=>i.id===id);if(x)Object.assign(x,patch);if(LIVE){await sb.from("inventory").update(patch).eq("id",id);}else saveLocal();rerender();}
const invTimers={}, invPending={};
function saveInvSoon(id,patch){ invPending[id]=Object.assign(invPending[id]||{},patch); clearTimeout(invTimers[id]); invTimers[id]=setTimeout(async()=>{const p=invPending[id];delete invPending[id]; if(LIVE){try{await sb.from("inventory").update(p).eq("id",id);}catch(e){toast("Couldn't save — check connection");}} else saveLocal();},450); }
async function addInv(kind){ kind=kind==="material"?"material":"blank"; const row={kind,name:"",on_hand:0,reorder_at:0,unit:kind==="blank"?"ea":"jars"}; let x={id:uid(),...row};
  if(LIVE){ try{ const {data,error}=await sb.from("inventory").insert(row).select().single(); if(error) throw error; x=data; }catch(e){ toast("Couldn't add — check connection"); return; } }
  S.inventory.push(x); if(!LIVE) saveLocal(); rerender();
  const el=document.querySelector(`.icard[data-inv="${x.id}"] [data-ifield="name"]`); if(el){ el.placeholder=kind==="blank"?"Garment name":"Dye or material"; el.focus(); el.scrollIntoView({block:"center",behavior:"smooth"}); } }
async function rmInv(id){const gone=S.inventory.find(i=>i.id===id); if(gone&&(gone.name||"").trim()){const list=prList(gone.kind),j=list.findIndex(x=>x.name===gone.name); if(j>=0){ if(gone.kind==="blank"&&list.length<=1){toast("Keep at least one garment");return;} list.splice(j,1); snapPricing(); try{await persistPricing();}catch(e){} }} S.inventory=S.inventory.filter(i=>i.id!==id);if(LIVE){await sb.from("inventory").delete().eq("id",id);}else saveLocal();rerender();}
function importBlanks(){ const names=new Set(S.inventory.map(i=>i.name)); const add=S.pricing.blanks.filter(b=>!names.has(b.name)).map(b=>({id:uid(),kind:"blank",name:b.name,on_hand:0,reorder_at:0,unit:"ea"})); if(!add.length){toast("Already imported");return;} if(LIVE){sb.from("inventory").insert(add.map(a=>({kind:"blank",name:a.name,on_hand:0,reorder_at:0,unit:"ea"}))).then(()=>refetch("inventory"));}else{S.inventory.push(...add);saveLocal();rerender();} toast(add.length+" blanks added"); }

/* ─────────── Drawer ─────────── */
function openOrder(id){openKind="order";openId=id;renderDrawer();showDrawer();}
function openCustomer(name){openKind="customer";openId=name;renderDrawer();showDrawer();}
function showDrawer(){document.getElementById("drawer").classList.add("show");document.getElementById("scrim").classList.add("show");document.getElementById("drawer").setAttribute("aria-hidden","false");}
function closeDrawer(){openId=null;document.getElementById("drawer").classList.remove("show");document.getElementById("scrim").classList.remove("show");document.getElementById("drawer").setAttribute("aria-hidden","true");}
function renderDrawer(){ openKind==="customer"?renderCustDrawer():renderOrderDrawer(); }
function renderOrderDrawer(){
  const o=S.orders.find(x=>x.id===openId); const d=document.getElementById("drawer"); if(!o){closeDrawer();return;}
  const sub=orderSubtotal(o),chg=(o.orderCharge!=null)?+o.orderCharge||0:0,rsh=rushOf(o),tax=taxOf(o),tot=sub+chg+rsh+tax,dep=+o.deposit||0;
  d.innerHTML=`<div class="dr-head"><div style="min-width:0;flex:1"><div class="cust">${esc(o.customer.name||"Unnamed")}${rushOn(o)?' <span class="rush-tag sm">⚡ RUSH</span>':""}</div>
    <div class="sub">HL-${o.ref||"—"} · ${o.customer.phone?esc(o.customer.phone)+" · ":""}${o.customer.due?"due "+fmtDue(o.customer.due):"no due date"}</div></div>
    <button class="icon-btn" id="drClose">✕</button></div>
  <div class="dr-body">
    <div><div class="dr-sec-t">Stage</div><div class="seg stage" id="drSeg">${STAGES.map(s=>`<button data-st="${s.key}" aria-pressed="${s.key===o.status}" style="${s.key===o.status?`color:${s.hex};border-color:${s.hex}`:""}"><span class="d" style="background:${s.hex}"></span>${s.label}</button>`).join("")}</div></div>
    <div><div class="dr-sec-t">Pieces</div><ul class="dr-items">${o.items.map(it=>`<li><span class="q tnum">${+it.qty||0}×</span><span class="d">${esc(it.garment)} · ${esc(it.size)}<br><small>${esc(it.technique)} · ${esc(it.palette)} · ${it.colors} colors</small></span><span class="p tnum">${money(itemUnit(it)*(+it.qty||0))}</span></li>`).join("")}</ul></div>
    <div><div class="dr-sec-t">Invoice</div>
      <div class="inv-row"><span>Subtotal</span><b class="tnum">${money(sub)}</b></div>
      ${chg>0?`<div class="inv-row"><span>Order charge</span><b class="tnum">${money(chg)}</b></div>`:""}
      ${rsh>0?`<div class="inv-row"><span>Rush fee</span><b class="tnum">${money(rsh)}</b></div>`:""}
      ${tax>0?`<div class="inv-row"><span>Sales tax · ${taxRateOf(o)}%</span><b class="tnum">${money(tax)}</b></div>`:""}
      <div class="inv-row total"><span>Total</span><span class="big tnum">${money(tot)}</span></div>
      <div class="inv-row"><span>${o.paid?"Paid in full":"Deposit"}</span><b class="tnum">${money(o.paid?tot:dep)}</b></div>
      <div class="inv-row"><span>Balance due</span><b class="tnum">${o.paid?'<span class="paid">Paid</span>':money(tot-dep)}</b></div>
      <div class="save-row"><button class="btn sm ${o.paid?"":"berry"}" id="drPaid">${o.paid?"Mark unpaid":"Mark paid in full"}</button></div></div>
    ${o.notes?`<div><div class="dr-sec-t">Notes</div><div class="note-box">${esc(o.notes)}</div></div>`:""}
    <div><div class="dr-sec-t">Finished pieces</div><div class="photo-grid">${(o.photos||[]).map(u=>`<img src="${esc(u)}" alt="piece">`).join("")}<label class="photo-add">+<input type="file" accept="image/*" id="drPhoto" hidden></label></div></div>
    <div><div class="dr-sec-t">Send ${o.paid?"receipt":"invoice"}${o.customer[sentKey(o)]?` <span class="sent-tag">✓ Sent ${fmtShort(o.customer[sentKey(o)])}</span>`:""}</div>
      <div class="send-grid">
        <button class="send-btn primary" id="sdSend"><span class="si"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></span><span><b>Send ${o.paid?"receipt":"invoice"}</b><small>${canShareFiles()?"Text, email, DM…":"Download + attach"}</small></span></button>
        <button class="send-btn" id="sdPdf"><span class="si"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg></span><span><b>Download PDF</b><small>Save or print</small></span></button>
      </div>
      ${o.customer[sentKey(o)]?"":`<button class="linkbtn" id="sdMark" style="margin-top:10px">Sent it another way? Mark as sent</button>`}
      ${S.settings.payWith||o.paid?"":`<div class="hint">Tip: add how customers pay you (Venmo, Cash App…) in <a href="#" id="sdSet">Settings</a> and it goes on every invoice.</div>`}</div>
    <div><div class="dr-sec-t">Hand off</div><div class="seg handoff"><button id="drTicket">⤓ Work ticket</button></div></div>
  </div>
  <div class="dr-foot"><button class="btn danger ghost" id="drDel">Delete</button><button class="btn" id="drEdit">Edit</button><button class="btn berry block" id="drDone">Done</button></div>`;
  d.querySelector("#drClose").onclick=closeDrawer; d.querySelector("#drDone").onclick=closeDrawer;
  d.querySelector("#drDel").onclick=()=>{removeOrder(o.id);closeDrawer();};
  d.querySelector("#drEdit").onclick=()=>{loadDraft(o);closeDrawer();tab="new";renderApp();};
  d.querySelector("#drPaid").onclick=()=>togglePaid(o.id);
  d.querySelector("#sdSend").onclick=()=>sendPdf(o);
  d.querySelector("#sdPdf").onclick=()=>downloadPdf(o);
  const smk=d.querySelector("#sdMark"); if(smk) smk.onclick=()=>{markSent(o);toast("Marked as sent");};
  const sst=d.querySelector("#sdSet"); if(sst) sst.onclick=e=>{e.preventDefault();closeDrawer();tab="settings";renderApp();};
  d.querySelector("#drTicket").onclick=()=>downloadTicket(o);
  d.querySelectorAll("#drSeg button").forEach(b=>b.onclick=()=>changeStatus(o.id,b.dataset.st));
  const ph=d.querySelector("#drPhoto"); if(ph) ph.onchange=()=>addPhoto(o,ph.files[0]);
}
function renderCustDrawer(){
  const name=openId; const d=document.getElementById("drawer");
  const c=custAgg().find(x=>x.name===name); const list=S.orders.filter(o=>(o.customer&&o.customer.name)===name);
  if(!c){closeDrawer();return;}
  const owes=list.reduce((s,o)=>s+balance(o),0), tel=(c.phone||"").replace(/[^\d+]/g,"");
  d.innerHTML=`<div class="dr-head"><div class="cav lg">${esc(initials(c.name))}</div><div style="flex:1;min-width:0"><div class="cust">${esc(c.name)}</div>
    <div class="sub"><span class="badge ${c.kind==="wholesale"?"whole":""}">${c.kind}</span>${c.last?` · last order ${fmtShort(c.last)}`:""}</div></div>
    <button class="icon-btn" id="drClose">✕</button></div>
  <div class="dr-body">
    <div class="cstats"><div><b class="tnum">${c.orders}</b><span>order${c.orders===1?"":"s"}</span></div><div><b class="tnum">${money(c.spent)}</b><span>lifetime</span></div><div><b class="tnum ${owes>0.005?"owe":""}">${money(owes)}</b><span>owes</span></div></div>
    <div><div class="dr-sec-t">Contact</div>
      ${c.phone?`<div class="crow"><span class="ci">${ICO.phone}</span><span class="cv"><small>Phone</small>${esc(c.phone)}</span>${tel.length>=7?`<a class="cbtn" href="tel:${esc(tel)}">Call</a><a class="cbtn" href="sms:${esc(tel)}">Text</a>`:""}</div>`:""}
      ${c.email?`<div class="crow"><span class="ci">${ICO.mail}</span><span class="cv"><small>Email</small>${esc(c.email)}</span><a class="cbtn" href="mailto:${esc(c.email)}">Email</a></div>`:""}
      ${!c.phone&&!c.email?`<div class="muted" style="font-size:13.5px">No contact on file. Add a phone or email on their next order.</div>`:""}
    </div>
    <div><div class="dr-sec-t">Orders</div><ul class="dr-items">${list.map(o=>`<li data-open="${o.id}" style="cursor:pointer"><span class="q tnum">HL-${o.ref}</span><span class="d">${esc(stageOf(o.status).label)}${rushOn(o)?' <span class="rush-tag sm">⚡ RUSH</span>':""}<br><small>${orderPieces(o)} pieces · ${fmtShort(o.createdAt)}${balance(o)>0.005?` · owes ${money(balance(o))}`:o.paid?" · paid":""}</small></span><span class="p tnum">${money(orderTotal(o))}</span></li>`).join("")}</ul></div>
  </div>
  <div class="dr-foot"><button class="btn berry block" id="drDone">Done</button></div>`;
  d.querySelector("#drClose").onclick=closeDrawer; d.querySelector("#drDone").onclick=closeDrawer;
  d.querySelectorAll("[data-open]").forEach(el=>el.onclick=()=>openOrder(el.dataset.open));
}
async function addPhoto(o,file){
  if(!file) return;
  if(LIVE){ try{ const path=`${session.user.id}/${o.id}/${Date.now()}.jpg`; const up=await sb.storage.from("pieces").upload(path,file,{upsert:true}); if(up.error)throw up.error; const {data}=sb.storage.from("pieces").getPublicUrl(path); o.photos=(o.photos||[]).concat(data.publicUrl); await sb.from("orders").update({photos:o.photos}).eq("id",o.id);}catch(e){toast("Upload failed");return;} }
  else { const r=new FileReader(); r.onload=()=>{o.photos=(o.photos||[]).concat(r.result);saveLocal();renderDrawer();}; r.readAsDataURL(file); return; }
  renderDrawer();
}

/* ─────────── Hand-off / export ─────────── */
function invTotals(o){const sub=orderSubtotal(o),chg=(o.orderCharge!=null)?+o.orderCharge||0:0,rsh=rushOf(o),tax=taxOf(o),tot=sub+chg+rsh+tax,dep=o.paid?tot:(+o.deposit||0);return {sub,chg,rsh,tax,rate:taxRateOf(o),tot,dep,bal:tot-dep};}
function docType(o){return o&&o.paid?"Receipt":"Invoice";}
function sentKey(o){return o&&o.paid?"receiptAt":"invoicedAt";}
function invSubject(o){return `${docType(o)} HL-${o.ref||""} from ${S.settings.shop||"Hippy List"}`;}
async function markSent(o){ o.customer={...o.customer,[sentKey(o)]:new Date().toISOString()}; if(LIVE){try{await sb.from("orders").update({customer:o.customer}).eq("id",o.id);}catch(e){}} else saveLocal(); if(openId===o.id) renderDrawer(); }
/* PDF invoices — built on-device with jsPDF (vector text, loads on first use) */
let jspdfP=null;
function loadJsPDF(){ if(window.jspdf) return Promise.resolve(window.jspdf); if(jspdfP) return jspdfP;
  jspdfP=new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";s.onload=()=>res(window.jspdf);s.onerror=()=>{jspdfP=null;rej(new Error("jspdf"));};document.head.appendChild(s);});
  return jspdfP; }
function pdfSafe(s){ return String(s==null?"":s).replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[−–]/g,"-").replace(/…/g,"...").replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ—€]/g,"").trim(); }
function invFileName(o){ return `${docType(o)}-HL-${o.ref||""}-${(S.settings.shop||"Hippy List").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"")}.pdf`; }
async function buildInvoicePdf(o){
  const {jsPDF}=await loadJsPDF();
  const doc=new jsPDF({unit:"pt",format:"letter"}), W=612, H=792, M=54, R=W-M;
  const t=invTotals(o), st=S.settings, c=o.customer||{};
  const INK=[31,27,22], MUTED=[107,99,87], FAINT=[138,129,116], LINE=[221,214,200], BERRY=[181,35,90], GREEN=[47,156,106];
  const col=a=>doc.setTextColor(a[0],a[1],a[2]);
  const txt=(s,x,y,o2)=>doc.text(pdfSafe(s),x,y,o2||{});
  const spaced=(s,x,y,cs,al)=>{s=pdfSafe(s);doc.setCharSpace(cs);const w=doc.getTextWidth(s)+cs*Math.max(0,s.length-1);doc.text(s,al==="right"?x-w:x,y);doc.setCharSpace(0);};
  const label=(s,x,y,al)=>{doc.setFont("helvetica","bold");doc.setFontSize(8);col(FAINT);spaced(s.toUpperCase(),x,y,1.2,al);};
  let y=M+14;
  // header
  doc.setFont("times","bold");doc.setFontSize(26);col(INK);txt(st.shop||"Hippy List",M,y+10);
  doc.setFont("helvetica","normal");doc.setFontSize(10);col(MUTED);
  let fy=y+30;[st.owner,st.contact,st.email].filter(Boolean).forEach(l=>{txt(l,M,fy);fy+=14;});
  doc.setFont("helvetica","bold");doc.setFontSize(9);col(BERRY);spaced(docType(o).toUpperCase(),R,y-2,1.6,"right");
  doc.setFont("times","bold");doc.setFontSize(22);col(INK);txt(`HL-${o.ref||""}`,R,y+20,{align:"right"});
  doc.setFont("helvetica","normal");doc.setFontSize(10);col(MUTED);txt((o.paid?"Paid ":"")+new Date((o.paid&&c.paidAt)||Date.now()).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),R,y+36,{align:"right"});
  y=Math.max(fy,y+44)+8; doc.setDrawColor(INK[0],INK[1],INK[2]);doc.setLineWidth(1.6);doc.line(M,y,R,y);
  // bill to / needed by
  y+=28; label("Bill to",M,y); if(c.due) label("Needed by",M+300,y);
  doc.setFont("helvetica","bold");doc.setFontSize(11);col(INK);txt(c.name||"",M,y+17);
  doc.setFont("helvetica","normal");doc.setFontSize(10);col(MUTED);let by=y+32;[c.phone,c.email].filter(Boolean).forEach(l=>{txt(l,M,by);by+=14;});
  if(c.due){doc.setFont("helvetica","normal");doc.setFontSize(11);col(INK);txt(fmtDate(c.due),M+300,y+17);}
  y=by+18;
  // table
  const cQ=M, cI=M+40, cE=R-90, cA=R;
  const head=()=>{label("Qty",cQ,y);label("Item",cI,y);label("Each",cE,y,"right");label("Amount",cA,y,"right");y+=8;doc.setDrawColor(LINE[0],LINE[1],LINE[2]);doc.setLineWidth(.8);doc.line(M,y,R,y);y+=18;};
  head();
  (o.items||[]).forEach(it=>{
    const q=+it.qty||0,u=itemUnit(it); const det=doc.splitTextToSize(pdfSafe(`${it.technique} · ${it.palette} · ${+it.colors||0} colors`),cE-cI-70);
    const rowH=16+det.length*12+8; if(y+rowH>H-M-40){doc.addPage();y=M+10;head();}
    doc.setFont("helvetica","bold");doc.setFontSize(11);col(INK);txt(String(q),cQ,y);txt(`${it.garment}`,cI,y);
    const gw=doc.getTextWidth(pdfSafe(it.garment));doc.setFont("helvetica","normal");col(MUTED);txt(`·  ${it.size}`,cI+gw+4,y);
    col(INK);txt(money(u),cE,y,{align:"right"});txt(money(u*q),cA,y,{align:"right"});
    doc.setFontSize(9.5);col(MUTED);doc.text(det,cI,y+14);
    y+=rowH; doc.setDrawColor(238,232,220);doc.setLineWidth(.6);doc.line(M,y-12,R,y-12);
  });
  // totals
  const need=150+(st.payWith&&!o.paid?70:0)+(st.invoiceNote?30:0); if(y+need>H-M){doc.addPage();y=M+10;}
  const tx=R-230; y+=8;
  const trow=(l,v)=>{doc.setFont("helvetica","normal");doc.setFontSize(10.5);col(MUTED);txt(l,tx,y);doc.setFont("helvetica","bold");col(INK);txt(v,R,y,{align:"right"});y+=18;};
  trow("Subtotal",money(t.sub)); if(t.chg>0) trow("Order charge",money(t.chg)); if(t.rsh>0) trow("Rush fee",money(t.rsh)); if(t.tax>0) trow(`Sales tax (${t.rate}%)`,money(t.tax));
  doc.setDrawColor(INK[0],INK[1],INK[2]);doc.setLineWidth(1.6);doc.line(tx,y-6,R,y-6); y+=16;
  doc.setFont("times","bold");doc.setFontSize(18);col(INK);txt("Total",tx,y);txt(money(t.tot),R,y,{align:"right"}); y+=22;
  if(o.paid){
    doc.setFont("helvetica","normal");doc.setFontSize(10.5);col(MUTED);txt("Paid in full",tx,y+14);col(GREEN);doc.setFont("helvetica","bold");txt("Thank you!",tx,y+28);
    doc.setDrawColor(GREEN[0],GREEN[1],GREEN[2]);doc.setLineWidth(2.4);doc.roundedRect(R-92,y,92,32,4,4);
    doc.setFont("times","bold");doc.setFontSize(18);col(GREEN);{const pw=doc.getTextWidth("PAID")+2*3;doc.setCharSpace(2);doc.text("PAID",R-46-pw/2,y+22);doc.setCharSpace(0);} y+=48;
  } else {
    if(t.dep>0) trow("Deposit paid","-"+money(t.dep));
    doc.setFillColor(BERRY[0],BERRY[1],BERRY[2]);doc.roundedRect(tx-10,y-4,R-tx+10,30,4,4,"F");
    doc.setFont("helvetica","bold");doc.setFontSize(11.5);doc.setTextColor(255,255,255);txt("Balance due",tx,y+15);txt(money(t.bal),R-10,y+15,{align:"right"}); y+=46;
  }
  // how to pay
  if(st.payWith&&!o.paid){
    const pl=doc.splitTextToSize(pdfSafe(st.payWith),R-M-28); const bh=34+pl.length*14;
    doc.setFillColor(246,241,230);doc.roundedRect(M,y,R-M,bh,6,6,"F"); label("How to pay",M+14,y+18);
    doc.setFont("helvetica","normal");doc.setFontSize(11);col(INK);doc.text(pl,M+14,y+34); y+=bh+20;
  }
  if(st.invoiceNote){doc.setFont("times","italic");doc.setFontSize(12);col(MUTED);txt(st.invoiceNote,W/2,y+6,{align:"center"});}
  doc.setProperties({title:invSubject(o),author:st.shop||"Hippy List"});
  return new File([doc.output("blob")],invFileName(o),{type:"application/pdf"});
}
function canShareFiles(){ try{ return !!(navigator.canShare&&navigator.canShare({files:[new File(["x"],"x.pdf",{type:"application/pdf"})]})); }catch(e){ return false; } }
function saveBlob(file){ const u=URL.createObjectURL(file); const a=document.createElement("a"); a.href=u; a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); }
async function sendPdf(o){
  let file; try{ toast("Building PDF…"); file=await buildInvoicePdf(o); }catch(e){ toast("Couldn't build PDF — check connection"); return; }
  if(canShareFiles()){
    try{ await navigator.share({files:[file],title:invSubject(o),text:invSubject(o)}); }
    catch(e){ if(e&&e.name==="AbortError") return; saveBlob(file); toast("PDF saved — attach it to your message"); return; }
    await markSent(o); toast(`${docType(o)} sent ✌`); return;
  }
  saveBlob(file); toast("PDF saved — attach it to your message"); await markSent(o);
}
async function downloadPdf(o){ try{ toast("Building PDF…"); saveBlob(await buildInvoicePdf(o)); toast("PDF saved"); }catch(e){ toast("Couldn't build PDF — check connection"); } }
function ticketText(o){const L=[`${S.settings.shop||"Hippy List"} — WORK TICKET`,`Order HL-${o.ref||""} · ${o.customer.name||""}`];if(o.customer.due)L.push("DUE: "+fmtDate(o.customer.due));L.push("Stage: "+stageOf(o.status).label,"");o.items.forEach(it=>{L.push(`[ ] ${+it.qty||0}x  ${it.garment} (${it.size})`);L.push(`      ${it.technique} · ${it.palette} · ${it.colors} dye colors`);});if(o.notes){L.push("","NOTES: "+o.notes);}return L.join("\n");}
function downloadTicket(o){downloadFile(`HippyList-HL${o.ref||""}.txt`,ticketText(o));}
function exportOrders(){const rows=[["Order","Customer","Type","Stage","Pieces","Due","Rush","Sales tax","Total","Deposit","Paid","Created"]];S.orders.forEach(o=>rows.push([`HL-${o.ref||""}`,o.customer.name||"",o.customer.kind||"",stageOf(o.status).label,orderPieces(o),o.customer.due||"",rushOn(o)?rushOf(o).toFixed(2):"",taxOf(o)?taxOf(o).toFixed(2):"",orderTotal(o).toFixed(2),(+o.deposit||0).toFixed(2),o.paid?"yes":"no",(o.createdAt||"").slice(0,10)]));downloadFile("hippy-orders.csv",rows.map(r=>r.map(csv).join(",")).join("\n"));toast("Exported");}
function exportCustomers(){const rows=[["Name","Type","Phone","Email","Orders","Lifetime"]];custAgg().forEach(c=>rows.push([c.name,c.kind,c.phone||"",c.email||"",c.orders,c.spent.toFixed(2)]));downloadFile("hippy-customers.csv",rows.map(r=>r.map(csv).join(",")).join("\n"));toast("Exported");}
function downloadFile(name,text){const b=new Blob([text],{type:"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}

/* ─────────── Helpers ─────────── */
function freshItem(){return {garment:S.pricing.blanks[0].name,size:"L",qty:1,technique:S.pricing.techniques[0].name,palette:"Rainbow",colors:3,price:""};}
function freshDraft(){return {customer:{name:"",phone:"",email:"",due:"",kind:"retail",rush:false,taxExempt:null},items:[freshItem()],deposit:"",notes:""};}
function loadDraft(o){editId=o.id;draft={customer:{name:o.customer.name||"",phone:o.customer.phone||"",email:o.customer.email||"",due:o.customer.due||"",kind:o.customer.kind||"retail",rush:!!o.customer.rush,taxExempt:o.customer.taxExempt!=null?o.customer.taxExempt:null},deposit:o.deposit||"",notes:o.notes||"",items:(o.items||[]).map(it=>({garment:it.garment,size:it.size,qty:it.qty,technique:it.technique,palette:it.palette,colors:it.colors,price:it.price==null?"":it.price}))};if(!draft.items.length)draft.items=[freshItem()];}
function rushOn(o){return o&&o.customer&&o.customer.rush?1:0;}
function nextRef(){return Math.max(1000,...S.orders.map(o=>+o.ref||0))+1;}
function clone(o){return JSON.parse(JSON.stringify(o));}
function num(v){const n=parseFloat(v);return isNaN(n)?0:n;}
function uid(){return "x"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function normalizePricing(p){const b=clone(DEFAULT_PRICING),o=Object.assign(b,p||{});["blanks","materials","techniques"].forEach(k=>(o[k]||[]).forEach(x=>{if(x&&!x.id)x.id=uid();}));if(!o.rush||typeof o.rush!=="object")o.rush=clone(DEFAULT_PRICING.rush);if(o.taxRate==null)o.taxRate=0;if(!Array.isArray(o.materials)||!o.materials.length)o.materials=clone(DEFAULT_PRICING.materials);if(!Array.isArray(o.blanks)||!o.blanks.length)o.blanks=clone(DEFAULT_PRICING.blanks);if(!Array.isArray(o.techniques)||!o.techniques.length)o.techniques=clone(DEFAULT_PRICING.techniques);return o;}
function money(n){n=+n||0;return "$"+n.toLocaleString("en-US",{minimumFractionDigits:(n%1?2:0),maximumFractionDigits:2});}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function csv(s){s=String(s==null?"":s);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function mOrder(o,q){return (o.customer&&o.customer.name||"").toLowerCase().includes(q)||("hl-"+(o.ref||"")).includes(q)||o.items.some(it=>(it.technique||"").toLowerCase().includes(q));}
function dueKey(o){const s=o.customer&&o.customer.due;return s?Date.parse(s):8.64e15;}
function dueClass(due){if(!due)return "";const d=Math.ceil((Date.parse(due)-Date.now())/864e5);if(isNaN(d))return "";if(d<0)return "over";if(d<=4)return "soon";return "";}
function fmtDue(due){const d=Math.ceil((Date.parse(due)-Date.now())/864e5);const dt=new Date(due+"T00:00:00");const l=dt.toLocaleDateString("en-US",{month:"short",day:"numeric"});if(isNaN(d))return l;if(d<0)return `${l} · ${-d}d late`;if(d===0)return `${l} · today`;if(d<=4)return `${l} · ${d}d`;return l;}
function fmtDate(s){const d=new Date(s+"T00:00:00");return isNaN(d)?s:d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});}
function fmtShort(s){const d=new Date(s);return isNaN(d)?"":d.toLocaleDateString("en-US",{month:"short",day:"numeric"});}
function searchIco(){return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`;}
function emptyState(t,s){return `<div class="empty"><h3>${t}</h3><p>${s}</p></div>`;}
function bind(id,set){const el=document.getElementById(id);if(el)el.addEventListener("input",()=>set(el.value));}
function val(id){const el=document.getElementById(id);return el?el.value:"";}
function setTxt(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function toast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("show"),1900);}
function drawSpiral(){const c=document.getElementById("spiral");if(!c)return;const g=c.getContext("2d"),cx=c.width/2,cy=c.height/2;g.clearRect(0,0,c.width,c.height);const cols=["#b5235a","#e0a318","#189e86","#2f72c4","#7b4dd6","#c0405f"];const sc=c.width/80;for(let a=0;a<Math.PI*2*4.3;a+=0.1){const r=a*1.9*sc,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;g.fillStyle=cols[Math.floor(a/(Math.PI/1.5))%6];g.beginPath();g.arc(x,y,2.3*sc,0,7);g.fill();}}

boot();
})();
