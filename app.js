/* Hippy List — tie-dye order shop. Standalone web app.
   Backend: Supabase (auth + Postgres + storage) when config.js is filled;
   otherwise a local demo mode (localStorage) so it runs anywhere.
   Sections: Board · Orders · Customers · Inventory · Money · Pricing. */
(function(){
"use strict";

/* ─────────── Config / backend ─────────── */
const CFG = window.HIPPY_CONFIG || {};
const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
const sb = LIVE ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
const LS = "hippylist.app.v1";

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
  renderApp(); if(openId) renderDrawer();
}
function rowToOrder(r){ return {id:r.id,ref:r.ref,status:r.status,customer:r.customer||{},items:r.items||[],deposit:+r.deposit||0,orderCharge:+r.order_charge||0,paid:!!r.paid,photos:r.photos||[],notes:r.notes||"",createdAt:r.created_at}; }
function orderToRow(o){ return {status:o.status,customer:o.customer,items:o.items,deposit:o.deposit,order_charge:o.orderCharge||0,paid:!!o.paid,photos:o.photos||[],notes:o.notes||""}; }

/* ─────────── Data: local ─────────── */
function loadLocal(){
  try{ const raw=localStorage.getItem(LS); if(raw){ const d=JSON.parse(raw); S=Object.assign(S,d); S.pricing=normalizePricing(S.pricing); return; } }catch(e){}
  S=seed();
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
function orderTotal(o){const c=(o.orderCharge!=null)?+o.orderCharge||0:orderChargeLive();return orderSubtotal(o)+c;}
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
  wireTop(); wireView();
}
function topbar(){
  const tabs=[["board","Board"],["orders","Orders"],["customers","Customers"],["inventory","Inventory"],["money","Money"],["pricing","Pricing"]];
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
  if(tab==="money")return renderMoney();
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
    const inSt=shown.filter(o=>o.status===s.key).sort((a,b)=>dueKey(a)-dueKey(b));
    h+=`<section class="col"><div class="colhead"><span class="dot" style="background:${s.hex}"></span><span class="colname">${s.label}</span><span class="n tnum">${inSt.length}</span></div>
      <div class="col-body">${inSt.length?inSt.map(o=>boardCard(o,s)).join(""):`<div class="col-empty">—</div>`}</div></section>`;
  });
  return h+`</div>`;
}
function boardCard(o,s){
  const dc=dueClass(o.customer&&o.customer.due), idx=stageIdx(o.status);
  const prog = o.status==="dyeing"?`<div class="bars"><i style="background:${s.hex}"></i><i style="background:${s.hex}"></i><i></i><i></i></div>`:"";
  return `<article class="ocard" tabindex="0" role="button" data-open="${o.id}">
    <div class="oc-top"><span class="cust">${esc(o.customer&&o.customer.name||"Unnamed")}</span><span class="ref">HL-${o.ref||"—"}</span></div>
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
    <td class="nm">${esc(o.customer&&o.customer.name||"Unnamed")}</td>
    <td><span class="badge" style="color:${st.hex}">● ${st.label}</span></td>
    <td class="tnum">${orderPieces(o)}</td>
    <td>${o.customer&&o.customer.due?`<span class="${dueClass(o.customer.due)==='over'?'low':''}">${fmtDue(o.customer.due)}</span>`:"—"}</td>
    <td class="tnum" style="text-align:right;font-weight:700">${money(orderTotal(o))}</td>
    <td class="tnum" style="text-align:right">${o.paid?'<span class="paid">Paid</span>':money(balance(o))}</td></tr>`;});
  return h+`</tbody></table></div></div>`;
}

/* ─────────── Builder (new / edit order) ─────────── */
function renderBuilder(){
  const t=draft,sub=orderSubtotal(t),chg=orderChargeLive(),tot=sub+chg,dep=+t.deposit||0;
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
    <div class="inv-row"><span>Subtotal · <span class="tnum" id="sum-pc">${orderPieces(t)}</span> pc</span><b class="tnum" id="sum-sub">${money(sub)}</b></div>
    <div class="inv-row" id="sum-chg-row" style="${chg>0?"":"display:none"}"><span>Order charge</span><b class="tnum" id="sum-chg">${money(chg)}</b></div>
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
      <label class="fld">Garment<select class="inp" data-f="garment" data-i="${i}">${S.pricing.blanks.map(b=>`<option ${b.name===it.garment?"selected":""}>${esc(b.name)}</option>`).join("")}</select></label>
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
function renderCustomers(){
  const q=search.trim().toLowerCase();
  let list=custAgg(); if(q) list=list.filter(c=>c.name.toLowerCase().includes(q));
  let h=`<div class="view-head"><h1>Customers</h1><div class="sub">${list.length} total</div></div>`;
  h+=`<div class="toolbar"><div class="search">${searchIco()}<input id="search" value="${esc(search)}" placeholder="Search customers"></div></div>`;
  if(!list.length) return h+emptyState("No customers yet","They appear here as you take orders.");
  h+=`<div class="panel" style="padding:0"><div class="tablewrap"><table class="data"><thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>Orders</th><th style="text-align:right">Lifetime</th><th>Last order</th></tr></thead><tbody>`;
  list.forEach(c=>{h+=`<tr class="rowlink" data-cust="${esc(c.name)}">
    <td class="nm">${esc(c.name)}</td>
    <td><span class="badge ${c.kind==="wholesale"?"whole":""}">${c.kind}</span></td>
    <td class="muted">${esc(c.phone||c.email||"—")}</td>
    <td class="tnum">${c.orders}</td>
    <td class="tnum" style="text-align:right;font-weight:700">${money(c.spent)}</td>
    <td class="muted">${c.last?fmtShort(c.last):"—"}</td></tr>`;});
  return h+`</tbody></table></div></div>`;
}

/* ─────────── Inventory ─────────── */
function renderInventory(){
  const low=S.inventory.filter(x=>(+x.on_hand||0)<=(+x.reorder_at||0));
  let h=`<div class="view-head"><h1>Inventory</h1><div class="sub">${S.inventory.length} items · ${low.length} low</div><div class="right"><button class="btn sm" id="invImport">Import blanks from Pricing</button><button class="btn berry sm" id="invAdd">+ Add item</button></div></div>`;
  if(low.length) h+=`<div class="banner warn"><b>${low.length} item${low.length>1?"s":""} low:</b> ${low.map(x=>esc(x.name)).join(", ")}. Time to reorder.</div>`;
  ["blank","material"].forEach(kind=>{
    const items=S.inventory.filter(x=>x.kind===kind);
    if(!items.length) return;
    h+=`<div class="panel" style="padding:0;margin-bottom:16px"><div style="padding:14px 18px 0"><h2 style="margin:0">${kind==="blank"?"Blanks":"Dyes & materials"}</h2></div>
      <div class="tablewrap"><table class="data"><thead><tr><th>Item</th><th>On hand</th><th>Reorder at</th><th>Unit</th><th></th></tr></thead><tbody>`;
    items.forEach(x=>{const lowf=(+x.on_hand||0)<=(+x.reorder_at||0);h+=`<tr>
      <td class="nm">${esc(x.name)}</td>
      <td><span class="stepper"><button data-adj="${x.id}" data-d="-1">−</button><span class="${lowf?"low":""}">${x.on_hand}</span><button data-adj="${x.id}" data-d="1">+</button></span></td>
      <td><input class="tnum" style="width:64px;text-align:right;background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:6px" data-reorder="${x.id}" type="number" value="${x.reorder_at}"></td>
      <td class="muted">${esc(x.unit||"ea")}</td>
      <td style="text-align:right"><button class="btn sm ghost danger" data-invrm="${x.id}">✕</button></td></tr>`;});
    h+=`</tbody></table></div></div>`;
  });
  if(!S.inventory.length) h+=emptyState("No inventory tracked","Add blanks and dyes to watch your stock.");
  return h;
}

/* ─────────── Money ─────────── */
function renderMoney(){
  const booked=S.orders.reduce((s,o)=>s+orderTotal(o),0);
  const collected=S.orders.reduce((s,o)=>s+(o.paid?orderTotal(o):(+o.deposit||0)),0);
  const outstanding=booked-collected;
  const profit=S.orders.reduce((s,o)=>s+(orderTotal(o)-orderCost(o)),0);
  // last 6 months revenue
  const months=[]; const now=new Date();
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({key:d.toISOString().slice(0,7),label:d.toLocaleDateString("en-US",{month:"short"}),v:0});}
  S.orders.forEach(o=>{const k=(o.createdAt||"").slice(0,7);const m=months.find(x=>x.key===k);if(m)m.v+=orderTotal(o);});
  const max=Math.max(1,...months.map(m=>m.v));
  let h=`<div class="view-head"><h1>Money</h1><div class="sub">Across all orders</div><div class="right"><button class="btn sm" id="exportOrders">Export orders CSV</button></div></div>`;
  h+=`<div class="money-cards">
    <div class="mcard"><div class="l">Booked value</div><div class="v berry tnum">${money(booked)}</div><div class="s">${S.orders.length} orders</div></div>
    <div class="mcard"><div class="l">Collected</div><div class="v good tnum">${money(collected)}</div><div class="s">deposits + paid</div></div>
    <div class="mcard"><div class="l">Outstanding</div><div class="v tnum">${money(outstanding)}</div><div class="s">still owed</div></div>
    <div class="mcard"><div class="l">Est. profit</div><div class="v tnum">${money(profit)}</div><div class="s">after materials + labor</div></div></div>`;
  h+=`<div class="panel"><h2>Revenue — last 6 months</h2><div class="barchart">${months.map(m=>`<div class="bg"><div class="bv tnum">${m.v?money(m.v):""}</div><div class="bar" style="height:${Math.round(m.v/max*140)}px"></div><div class="bl">${m.label}</div></div>`).join("")}</div></div>`;
  return h;
}

/* ─────────── Pricing ─────────── */
function renderPricing(){
  const p=S.pricing;
  const matRows=(p.materials||[]).map((m,i)=>`<tr><td><input class="rate-name" data-mt="name" data-mi="${i}" value="${esc(m.name)}"></td><td><input data-mt="cost" data-mi="${i}" type="number" min="0" step="0.05" value="${m.cost}"></td><td><select data-mt="per" data-mi="${i}"><option value="piece" ${m.per==="piece"?"selected":""}>per piece</option><option value="color" ${m.per==="color"?"selected":""}>per dye color</option><option value="order" ${m.per==="order"?"selected":""}>per order</option></select></td><td style="text-align:right"><button class="btn sm ghost danger" data-mrm="${i}">✕</button></td></tr>`).join("");
  const blankRows=p.blanks.map((b,i)=>`<tr><td><input class="rate-name" data-bt="name" data-bi="${i}" value="${esc(b.name)}"></td><td><input data-bt="cost" data-bi="${i}" type="number" min="0" step="0.25" value="${b.cost}"></td><td style="text-align:right"><button class="btn sm ghost danger" data-brm="${i}">✕</button></td></tr>`).join("");
  const techRows=p.techniques.map((t,i)=>`<tr><td><input class="rate-name" data-tt="name" data-ti="${i}" value="${esc(t.name)}"></td><td><input data-tt="min" data-ti="${i}" type="number" min="0" step="1" value="${t.min}"></td><td style="text-align:right"><button class="btn sm ghost danger" data-trm="${i}">✕</button></td></tr>`).join("");
  return `<div class="view-head"><h1>Pricing</h1><div class="sub">Your cost model — every order prices from here</div><div class="right"><button class="btn berry" id="savePricing">Save pricing</button></div></div>
  <div class="banner">Set these to your real blank costs, ink prices, dye-time and margin. Edits apply to new orders; saved orders keep their quoted price.</div>
  <div class="panel"><h2>Shop rates</h2><div class="grid3">
    <label class="fld">Labor rate ($/hr)<input class="inp tnum" id="s-labor" type="number" min="0" step="1" value="${p.laborRate}"></label>
    <label class="fld">Markup (× cost)<input class="inp tnum" id="s-markup" type="number" min="1" step="0.1" value="${p.markup}"></label>
    <label class="fld">Round to nearest $<input class="inp tnum" id="s-round" type="number" min="0" step="0.25" value="${p.roundTo}"></label></div>
    <div class="hint">Labor = minutes per technique (below) × this hourly rate.</div></div>
  <div class="panel"><h2>Dyes & materials</h2><div class="tablewrap"><table class="data rates"><thead><tr><th>Material / ink</th><th>Cost $</th><th>Charged</th><th></th></tr></thead><tbody>${matRows}</tbody></table></div><button class="btn sm" id="addMat" style="margin-top:12px">+ Add dye / material</button><div class="hint">“Per dye color” × the colors in each piece. “Per order” is added once.</div></div>
  <div class="panel"><h2>Blanks (cost each)</h2><div class="tablewrap"><table class="data rates"><thead><tr><th>Garment</th><th>Cost $</th><th></th></tr></thead><tbody>${blankRows}</tbody></table></div><button class="btn sm" id="addBlank" style="margin-top:12px">+ Add garment</button></div>
  <div class="panel"><h2>Techniques (minutes each)</h2><div class="tablewrap"><table class="data rates"><thead><tr><th>Technique</th><th>Minutes</th><th></th></tr></thead><tbody>${techRows}</tbody></table></div><button class="btn sm" id="addTech" style="margin-top:12px">+ Add technique</button></div>`;
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
  ${LIVE?`<div class="panel"><h2>Account</h2><div class="muted" style="margin-bottom:12px">Signed in${session&&session.user?` as ${esc(session.user.email||"")}`:""}.</div><button class="btn danger" id="signout">Sign out</button></div>`:`<div class="panel"><h2>Account</h2><div class="muted">Running in local demo mode. Connect Supabase to enable accounts & sync.</div></div>`}`;
}

/* ─────────── Login ─────────── */
function renderLogin(){
  root().innerHTML=`<div class="login"><div class="login-card">
    <canvas id="spiral" width="112" height="112" style="width:56px;height:56px"></canvas>
    <div class="est">Est. handmade</div><div class="word">Hippy <em>List</em></div>
    <p>Sign in to your shop. We'll email you a magic link — no password.</p>
    <input id="authEmail" type="email" placeholder="you@email.com" value="${esc(authEmail)}" autocomplete="email">
    <button class="btn berry block" id="sendLink">Send magic link</button>
    <div class="hint" id="authMsg"></div>
  </div></div>`;
  drawSpiral();
  const inp=document.getElementById("authEmail"), btn=document.getElementById("sendLink");
  inp.oninput=()=>authEmail=inp.value;
  btn.onclick=async()=>{ if(!authEmail.includes("@")){toast("Enter your email");return;} btn.disabled=true; btn.textContent="Sending…";
    try{ await sb.auth.signInWithOtp({email:authEmail,options:{emailRedirectTo:location.href}}); document.getElementById("authMsg").textContent="Check your email for the link.";}catch(e){toast("Couldn't send — try again");} btn.disabled=false; btn.textContent="Send magic link"; };
}

/* ─────────── Wiring ─────────── */
function wireTop(){
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;search="";renderApp();});
  const nb=document.getElementById("newBtn"); if(nb) nb.onclick=()=>{startNew();};
  const sb2=document.getElementById("setBtn"); if(sb2) sb2.onclick=()=>{tab="settings";renderApp();};
}
function startNew(){ editId=null; draft=freshDraft(); tab="new"; renderApp(); }

function wireView(){
  const sb2=document.getElementById("search"); if(sb2) sb2.oninput=()=>{search=sb2.value; const v=document.getElementById("view"); v.innerHTML=viewHtml(); wireView(); const n=document.getElementById("search"); if(n){n.focus();const x=n.value;n.value="";n.value=x;}};
  document.querySelectorAll("[data-open]").forEach(el=>{el.onclick=()=>openOrder(el.dataset.open);el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openOrder(el.dataset.open);}};});
  document.querySelectorAll("[data-mv]").forEach(b=>b.onclick=e=>{e.stopPropagation();moveStage(b.dataset.mv,+b.dataset.dir);});
  document.querySelectorAll("[data-cust]").forEach(el=>el.onclick=()=>openCustomer(el.dataset.cust));
  const nb2=document.getElementById("newBtn2"); if(nb2) nb2.onclick=startNew;

  if(tab==="new") wireBuilder();
  if(tab==="inventory") wireInventory();
  if(tab==="pricing") wirePricing();
  if(tab==="settings") wireSettings();
  if(tab==="money"){ const e=document.getElementById("exportOrders"); if(e) e.onclick=exportOrders; }
}
function wireBuilder(){
  bind("d-name",v=>draft.customer.name=v); bind("d-phone",v=>draft.customer.phone=v); bind("d-email",v=>draft.customer.email=v);
  bind("d-due",v=>draft.customer.due=v); bind("d-kind",v=>draft.customer.kind=v); bind("d-notes",v=>draft.notes=v);
  const dep=document.getElementById("d-dep"); if(dep) dep.oninput=()=>{draft.deposit=num(dep.value);soft();};
  document.querySelectorAll("#items [data-f]").forEach(el=>{const i=+el.dataset.i,f=el.dataset.f;el.addEventListener(el.tagName==="SELECT"?"change":"input",()=>{draft.items[i][f]=el.value;soft();});});
  document.querySelectorAll("[data-bd]").forEach(b=>b.onclick=()=>{const el=document.getElementById("bd-"+b.dataset.bd);el.classList.toggle("open");b.textContent=el.classList.contains("open")?"hide math":"price math";});
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{draft.items.splice(+b.dataset.rm,1);rerender();});
  const ai=document.getElementById("addItem"); if(ai) ai.onclick=()=>{draft.items.push(freshItem());rerender();};
  document.getElementById("saveOrder").onclick=saveOrder;
  document.getElementById("clearDraft").onclick=()=>{const w=!!editId;editId=null;draft=freshDraft();tab=w?"orders":"new";renderApp();};
}
function soft(){
  draft.items.forEach((it,i)=>{const row=document.querySelector(`.lineitem[data-i="${i}"]`);if(!row)return;const p=row.querySelector('[data-f="price"]');if(p)p.placeholder=String(suggestP(it));const bd=row.querySelector(".breakdown");if(bd)bd.textContent=priceMath(it);});
  const sub=orderSubtotal(draft),chg=orderChargeLive(),tot=sub+chg,dep=num(draft.deposit);
  setTxt("sum-sub",money(sub));setTxt("sum-chg",money(chg));setTxt("sum-tot",money(tot));setTxt("sum-bal",money(tot-dep));setTxt("sum-pc",orderPieces(draft));
  const cr=document.getElementById("sum-chg-row");if(cr)cr.style.display=chg>0?"":"none";
}
function wireInventory(){
  document.querySelectorAll("[data-adj]").forEach(b=>b.onclick=()=>adjInv(b.dataset.adj,+b.dataset.d));
  document.querySelectorAll("[data-reorder]").forEach(el=>el.onchange=()=>setInv(el.dataset.reorder,{reorder_at:num(el.value)}));
  document.querySelectorAll("[data-invrm]").forEach(b=>b.onclick=()=>rmInv(b.dataset.invrm));
  const a=document.getElementById("invAdd"); if(a) a.onclick=addInv;
  const im=document.getElementById("invImport"); if(im) im.onclick=importBlanks;
}
function wirePricing(){
  const n=(id,k)=>{const el=document.getElementById(id);if(el)el.oninput=()=>S.pricing[k]=num(el.value);};
  n("s-labor","laborRate");n("s-markup","markup");n("s-round","roundTo");
  document.querySelectorAll("[data-mt]").forEach(el=>{const i=+el.dataset.mi,f=el.dataset.mt;el.addEventListener(el.tagName==="SELECT"?"change":"input",()=>{S.pricing.materials[i][f]=f==="cost"?num(el.value):el.value;});});
  document.querySelectorAll("[data-mrm]").forEach(b=>b.onclick=()=>{S.pricing.materials.splice(+b.dataset.mrm,1);rerender();});
  document.querySelectorAll("[data-bt]").forEach(el=>el.oninput=()=>{const i=+el.dataset.bi,f=el.dataset.bt;S.pricing.blanks[i][f]=f==="cost"?num(el.value):el.value;});
  document.querySelectorAll("[data-brm]").forEach(b=>b.onclick=()=>{S.pricing.blanks.splice(+b.dataset.brm,1);rerender();});
  document.querySelectorAll("[data-tt]").forEach(el=>el.oninput=()=>{const i=+el.dataset.ti,f=el.dataset.tt;S.pricing.techniques[i][f]=f==="min"?num(el.value):el.value;});
  document.querySelectorAll("[data-trm]").forEach(b=>b.onclick=()=>{S.pricing.techniques.splice(+b.dataset.trm,1);rerender();});
  document.getElementById("addMat").onclick=()=>{S.pricing.materials.push({name:"New material",cost:0.25,per:"piece"});rerender();};
  document.getElementById("addBlank").onclick=()=>{S.pricing.blanks.push({name:"New garment",cost:5});rerender();};
  document.getElementById("addTech").onclick=()=>{S.pricing.techniques.push({name:"New technique",min:5});rerender();};
  document.getElementById("savePricing").onclick=savePricing;
}
function wireSettings(){
  const saveSet=()=>{S.settings.shop=val("set-shop");S.settings.owner=val("set-owner");S.settings.contact=val("set-contact");S.settings.email=val("set-email");S.settings.payWith=val("set-pay");S.settings.invoiceNote=val("set-foot");savePricing("Saved");};
  ["saveSettings","saveSettings2"].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=saveSet;});
  const e1=document.getElementById("exportOrders2"); if(e1) e1.onclick=exportOrders;
  const e2=document.getElementById("exportCust"); if(e2) e2.onclick=exportCustomers;
  const so=document.getElementById("signout"); if(so) so.onclick=async()=>{await sb.auth.signOut();};
}

/* ─────────── Writes ─────────── */
async function saveOrder(){
  if(!draft.customer.name||!draft.customer.name.trim()){toast("Add a customer name");return;}
  const clean=draft.items.filter(it=>+it.qty>0); if(!clean.length){toast("Add at least one piece");return;}
  const items=clean.map(it=>({garment:it.garment,size:it.size,qty:+it.qty||0,technique:it.technique,palette:it.palette,colors:+it.colors||0,price:itemUnit(it)}));
  const cust={name:draft.customer.name.trim(),phone:draft.customer.phone||"",email:draft.customer.email||"",due:draft.customer.due||"",kind:draft.customer.kind||"retail"};
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
async function togglePaid(id){const o=S.orders.find(x=>x.id===id);if(!o)return;o.paid=!o.paid;if(LIVE){await sb.from("orders").update({paid:o.paid}).eq("id",id);}else saveLocal();rerender();renderDrawer();}
async function removeOrder(id){S.orders=S.orders.filter(x=>x.id!==id);if(LIVE){await sb.from("orders").delete().eq("id",id);}else saveLocal();rerender();toast("Order deleted");}
async function ensureCustomer(cust){
  if(S.customers.find(c=>c.name.toLowerCase()===cust.name.toLowerCase())) return;
  const rec={id:uid(),name:cust.name,phone:cust.phone||"",email:cust.email||"",kind:cust.kind||"retail",notes:""};
  if(LIVE){try{await sb.from("customers").insert({name:rec.name,phone:rec.phone,email:rec.email,kind:rec.kind});}catch(e){}} else {S.customers.push(rec);saveLocal();}
}
async function savePricing(msg){ S.pricing.settings=S.settings; if(LIVE){try{const r=await sb.from("pricing").upsert({user_id:session.user.id,data:S.pricing});if(r.error)throw r.error;}catch(e){toast("Couldn't save");return;}} else saveLocal(); toast(typeof msg==="string"?msg:"Pricing saved"); }

/* inventory ops */
async function adjInv(id,d){const x=S.inventory.find(i=>i.id===id);if(!x)return;x.on_hand=Math.max(0,(+x.on_hand||0)+d);await setInv(id,{on_hand:x.on_hand});}
async function setInv(id,patch){const x=S.inventory.find(i=>i.id===id);if(x)Object.assign(x,patch);if(LIVE){await sb.from("inventory").update(patch).eq("id",id);}else saveLocal();rerender();}
function addInv(){ const x={id:uid(),kind:"blank",name:"New blank",on_hand:0,reorder_at:0,unit:"ea"}; if(LIVE){sb.from("inventory").insert({kind:x.kind,name:x.name,on_hand:0,reorder_at:0,unit:"ea"}).then(()=>refetch("inventory"));}else{S.inventory.push(x);saveLocal();rerender();} }
async function rmInv(id){S.inventory=S.inventory.filter(i=>i.id!==id);if(LIVE){await sb.from("inventory").delete().eq("id",id);}else saveLocal();rerender();}
function importBlanks(){ const names=new Set(S.inventory.map(i=>i.name)); const add=S.pricing.blanks.filter(b=>!names.has(b.name)).map(b=>({id:uid(),kind:"blank",name:b.name,on_hand:0,reorder_at:0,unit:"ea"})); if(!add.length){toast("Already imported");return;} if(LIVE){sb.from("inventory").insert(add.map(a=>({kind:"blank",name:a.name,on_hand:0,reorder_at:0,unit:"ea"}))).then(()=>refetch("inventory"));}else{S.inventory.push(...add);saveLocal();rerender();} toast(add.length+" blanks added"); }

/* ─────────── Drawer ─────────── */
function openOrder(id){openKind="order";openId=id;renderDrawer();showDrawer();}
function openCustomer(name){openKind="customer";openId=name;renderDrawer();showDrawer();}
function showDrawer(){document.getElementById("drawer").classList.add("show");document.getElementById("scrim").classList.add("show");document.getElementById("drawer").setAttribute("aria-hidden","false");}
function closeDrawer(){openId=null;document.getElementById("drawer").classList.remove("show");document.getElementById("scrim").classList.remove("show");document.getElementById("drawer").setAttribute("aria-hidden","true");}
function renderDrawer(){ openKind==="customer"?renderCustDrawer():renderOrderDrawer(); }
function renderOrderDrawer(){
  const o=S.orders.find(x=>x.id===openId); const d=document.getElementById("drawer"); if(!o){closeDrawer();return;}
  const sub=orderSubtotal(o),chg=(o.orderCharge!=null)?+o.orderCharge||0:0,tot=sub+chg,dep=+o.deposit||0;
  d.innerHTML=`<div class="dr-head"><div style="min-width:0;flex:1"><div class="cust">${esc(o.customer.name||"Unnamed")}</div>
    <div class="sub">HL-${o.ref||"—"} · ${o.customer.phone?esc(o.customer.phone)+" · ":""}${o.customer.due?"due "+fmtDue(o.customer.due):"no due date"}</div></div>
    <button class="icon-btn" id="drClose">✕</button></div>
  <div class="dr-body">
    <div><div class="dr-sec-t">Stage</div><div class="seg stage" id="drSeg">${STAGES.map(s=>`<button data-st="${s.key}" aria-pressed="${s.key===o.status}" style="${s.key===o.status?`color:${s.hex};border-color:${s.hex}`:""}"><span class="d" style="background:${s.hex}"></span>${s.label}</button>`).join("")}</div></div>
    <div><div class="dr-sec-t">Pieces</div><ul class="dr-items">${o.items.map(it=>`<li><span class="q tnum">${+it.qty||0}×</span><span class="d">${esc(it.garment)} · ${esc(it.size)}<br><small>${esc(it.technique)} · ${esc(it.palette)} · ${it.colors} colors</small></span><span class="p tnum">${money(itemUnit(it)*(+it.qty||0))}</span></li>`).join("")}</ul></div>
    <div><div class="dr-sec-t">Invoice</div>
      <div class="inv-row"><span>Subtotal</span><b class="tnum">${money(sub)}</b></div>
      ${chg>0?`<div class="inv-row"><span>Order charge</span><b class="tnum">${money(chg)}</b></div>`:""}
      <div class="inv-row total"><span>Total</span><span class="big tnum">${money(tot)}</span></div>
      <div class="inv-row"><span>${o.paid?"Paid in full":"Deposit"}</span><b class="tnum">${money(o.paid?tot:dep)}</b></div>
      <div class="inv-row"><span>Balance due</span><b class="tnum">${o.paid?'<span class="paid">Paid</span>':money(tot-dep)}</b></div>
      <div class="save-row"><button class="btn sm ${o.paid?"":"berry"}" id="drPaid">${o.paid?"Mark unpaid":"Mark paid in full"}</button></div></div>
    ${o.notes?`<div><div class="dr-sec-t">Notes</div><div class="note-box">${esc(o.notes)}</div></div>`:""}
    <div><div class="dr-sec-t">Finished pieces</div><div class="photo-grid">${(o.photos||[]).map(u=>`<img src="${esc(u)}" alt="piece">`).join("")}<label class="photo-add">+<input type="file" accept="image/*" id="drPhoto" hidden></label></div></div>
    <div><div class="dr-sec-t">Send invoice${o.customer.invoicedAt?` <span class="sent-tag">✓ Sent ${fmtShort(o.customer.invoicedAt)}</span>`:""}</div>
      <div class="send-grid">
        <button class="send-btn${o.customer.phone?"":" off"}" id="sdText"><span class="si"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg></span><span><b>Text it</b><small>${esc(o.customer.phone||"No phone yet")}</small></span></button>
        <button class="send-btn${o.customer.email?"":" off"}" id="sdEmail"><span class="si"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span><span><b>Email it</b><small>${esc(o.customer.email||"No email yet")}</small></span></button>
        ${navigator.share?`<button class="send-btn" id="sdShare"><span class="si"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></span><span><b>Share…</b><small>Any app</small></span></button>`:""}
        <button class="send-btn" id="sdPdf"><span class="si"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg></span><span><b>PDF / print</b><small>Clean invoice</small></span></button>
      </div>
      ${S.settings.payWith?"":`<div class="hint">Tip: add how customers pay you (Venmo, Cash App…) in <a href="#" id="sdSet">Settings</a> and it goes on every invoice.</div>`}</div>
    <div><div class="dr-sec-t">Hand off</div><div class="seg handoff"><button id="drCopy">⧉ Copy invoice</button><button id="drTicket">⤓ Work ticket</button></div></div>
  </div>
  <div class="dr-foot"><button class="btn danger ghost" id="drDel">Delete</button><button class="btn" id="drEdit">Edit</button><button class="btn berry block" id="drDone">Done</button></div>`;
  d.querySelector("#drClose").onclick=closeDrawer; d.querySelector("#drDone").onclick=closeDrawer;
  d.querySelector("#drDel").onclick=()=>{removeOrder(o.id);closeDrawer();};
  d.querySelector("#drEdit").onclick=()=>{loadDraft(o);closeDrawer();tab="new";renderApp();};
  d.querySelector("#drPaid").onclick=()=>togglePaid(o.id);
  d.querySelector("#drCopy").onclick=()=>copyInvoice(o);
  d.querySelector("#sdText").onclick=()=>sendInvoice(o,"text");
  d.querySelector("#sdEmail").onclick=()=>sendInvoice(o,"email");
  d.querySelector("#sdPdf").onclick=()=>printInvoice(o);
  const shb=d.querySelector("#sdShare"); if(shb) shb.onclick=()=>sendInvoice(o,"share");
  const sst=d.querySelector("#sdSet"); if(sst) sst.onclick=e=>{e.preventDefault();closeDrawer();tab="settings";renderApp();};
  d.querySelector("#drTicket").onclick=()=>downloadTicket(o);
  d.querySelectorAll("#drSeg button").forEach(b=>b.onclick=()=>changeStatus(o.id,b.dataset.st));
  const ph=d.querySelector("#drPhoto"); if(ph) ph.onchange=()=>addPhoto(o,ph.files[0]);
}
function renderCustDrawer(){
  const name=openId; const d=document.getElementById("drawer");
  const c=custAgg().find(x=>x.name===name); const list=S.orders.filter(o=>(o.customer&&o.customer.name)===name);
  if(!c){closeDrawer();return;}
  d.innerHTML=`<div class="dr-head"><div style="flex:1;min-width:0"><div class="cust">${esc(c.name)}</div>
    <div class="sub"><span class="badge ${c.kind==="wholesale"?"whole":""}">${c.kind}</span> · ${c.orders} orders · ${money(c.spent)} lifetime</div></div>
    <button class="icon-btn" id="drClose">✕</button></div>
  <div class="dr-body">
    <div><div class="dr-sec-t">Contact</div><div class="note-box">${esc(c.phone||"")}${c.phone&&c.email?" · ":""}${esc(c.email||"")||((!c.phone&&!c.email)?"No contact on file":"")}</div></div>
    <div><div class="dr-sec-t">Orders</div><ul class="dr-items">${list.map(o=>`<li data-open="${o.id}" style="cursor:pointer"><span class="q tnum">HL-${o.ref}</span><span class="d">${esc(stageOf(o.status).label)}<br><small>${orderPieces(o)} pieces · ${fmtShort(o.createdAt)}</small></span><span class="p tnum">${money(orderTotal(o))}</span></li>`).join("")}</ul></div>
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
function invTotals(o){const sub=orderSubtotal(o),chg=(o.orderCharge!=null)?+o.orderCharge||0:0,tot=sub+chg,dep=o.paid?tot:(+o.deposit||0);return {sub,chg,tot,dep,bal:tot-dep};}
function invoiceText(o){const t=invTotals(o);const L=[`${S.settings.shop||"Hippy List"} — Invoice HL-${o.ref||""}`,o.customer.name||""];if(o.customer.due)L.push("Needed by "+fmtDate(o.customer.due));L.push("");o.items.forEach(it=>L.push(`${+it.qty||0}x ${it.garment} ${it.size} — ${it.technique}, ${it.palette}, ${it.colors} colors   ${money(itemUnit(it)*(+it.qty||0))}`));L.push("");L.push(`Subtotal   ${money(t.sub)}`);if(t.chg>0)L.push(`Order charge   ${money(t.chg)}`);L.push(`TOTAL   ${money(t.tot)}`);if(o.paid)L.push("PAID IN FULL — thank you!");else{if(t.dep>0)L.push(`Deposit paid   ${money(t.dep)}`);L.push(`BALANCE DUE   ${money(t.bal)}`);if(S.settings.payWith)L.push("","Pay with: "+S.settings.payWith);}if(S.settings.invoiceNote)L.push("",S.settings.invoiceNote);return L.join("\n");}
function invSubject(o){return `Invoice HL-${o.ref||""} from ${S.settings.shop||"Hippy List"}`;}
function isIOS(){return /iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);}
async function sendInvoice(o,via){
  const c=o.customer||{};
  if(via==="text"){ if(!c.phone){toast("Add a phone number — tap Edit");return;} const n=c.phone.replace(/[^\d+]/g,""); location.href=`sms:${n}${isIOS()?"&":"?"}body=${encodeURIComponent(invoiceText(o))}`; }
  else if(via==="email"){ if(!c.email){toast("Add an email — tap Edit");return;} location.href=`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(invSubject(o))}&body=${encodeURIComponent(invoiceText(o))}`; }
  else if(via==="share"){ try{ await navigator.share({title:invSubject(o),text:invoiceText(o)}); }catch(e){ return; } }
  await markSent(o);
}
async function markSent(o){ o.customer={...o.customer,invoicedAt:new Date().toISOString()}; if(LIVE){try{await sb.from("orders").update({customer:o.customer}).eq("id",o.id);}catch(e){}} else saveLocal(); if(openId===o.id) renderDrawer(); }
function invoiceHtml(o){
  const t=invTotals(o),st=S.settings,today=new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  const rows=o.items.map(it=>{const q=+it.qty||0,u=itemUnit(it);return `<tr><td class="q">${q}</td><td><b>${esc(it.garment)}</b> · ${esc(it.size)}<div class="det">${esc(it.technique)} · ${esc(it.palette)} · ${+it.colors||0} colors</div></td><td class="r">${money(u)}</td><td class="r">${money(u*q)}</td></tr>`;}).join("");
  const from=[st.owner,st.contact,st.email].filter(Boolean).map(esc).join("<br>");
  const to=[`<b>${esc(o.customer.name||"")}</b>`,esc(o.customer.phone||""),esc(o.customer.email||"")].filter(Boolean).join("<br>");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(invSubject(o))}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;600;700&display=swap">
<style>
*{box-sizing:border-box}body{margin:0;background:#efece4;color:#1f1b16;font:14px/1.5 "Hanken Grotesk",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:760px;margin:24px auto;background:#fffdf8;border:1px solid #ddd6c8;border-radius:10px;padding:44px 48px}
.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:2px solid #1f1b16;padding-bottom:22px}
.shop{font:600 30px/1.1 Fraunces,Georgia,serif;letter-spacing:-.01em}.from{color:#6b6357;margin-top:6px;font-size:13px}
.inv{text-align:right}.inv .t{font:600 13px "Hanken Grotesk";letter-spacing:.14em;text-transform:uppercase;color:#b5235a}.inv .n{font:600 26px Fraunces,Georgia,serif}.inv .d{color:#6b6357;font-size:13px}
.meta{display:flex;gap:40px;margin:24px 0 8px}.meta .l{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a8174;font-weight:700;margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin-top:18px}th{text-align:left;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a8174;border-bottom:1px solid #ddd6c8;padding:8px 6px}
td{padding:12px 6px;border-bottom:1px solid #eee8dc;vertical-align:top}.q{width:44px;font-weight:700}.r{text-align:right;white-space:nowrap}th.r{text-align:right}.det{color:#6b6357;font-size:12.5px}
.tot{margin-left:auto;width:300px;margin-top:16px}.tot div{display:flex;justify-content:space-between;padding:5px 0;color:#6b6357}.tot b{color:#1f1b16}
.tot .grand{border-top:2px solid #1f1b16;margin-top:6px;padding-top:10px;color:#1f1b16;font:600 22px Fraunces,Georgia,serif}
.tot .due{background:#b5235a;color:#fff;border-radius:6px;padding:10px 12px;margin-top:8px;font-weight:700}.tot .due b,.tot .due span{color:#fff}
.stamp{display:inline-block;border:3px solid #2f9c6a;color:#2f9c6a;font:600 20px Fraunces,serif;letter-spacing:.1em;padding:4px 14px;border-radius:6px;transform:rotate(-4deg);margin-top:14px}
.pay{margin-top:28px;background:#f6f1e6;border-radius:8px;padding:14px 16px;white-space:pre-wrap}.pay .l{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a8174;font-weight:700;margin-bottom:4px}
.note{margin-top:22px;text-align:center;color:#6b6357;font-style:italic;font-family:Fraunces,Georgia,serif}
.bar{max-width:760px;margin:16px auto 0;display:flex;gap:10px;justify-content:flex-end;padding:0 12px}.bar button{font:700 14px "Hanken Grotesk";border:0;border-radius:999px;padding:11px 20px;background:#b5235a;color:#fff;cursor:pointer}.bar button.g{background:#fff;color:#1f1b16;border:1px solid #ddd6c8}
@media(max-width:600px){.page{margin:12px;padding:26px 20px}.top{flex-direction:column}.inv{text-align:left}.meta{flex-direction:column;gap:14px}.tot{width:100%}}
@media print{body{background:#fff}.bar{display:none}.page{border:0;margin:0;max-width:none;padding:0}}
</style></head><body>
<div class="bar"><button class="g" onclick="window.close()">Close</button><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="page">
<div class="top"><div><div class="shop">${esc(st.shop||"Hippy List")}</div>${from?`<div class="from">${from}</div>`:""}</div>
<div class="inv"><div class="t">Invoice</div><div class="n">HL-${o.ref||""}</div><div class="d">${today}</div></div></div>
<div class="meta"><div><div class="l">Bill to</div>${to}</div>${o.customer.due?`<div><div class="l">Needed by</div>${fmtDate(o.customer.due)}</div>`:""}</div>
<table><thead><tr><th>Qty</th><th>Item</th><th class="r">Each</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot"><div><span>Subtotal</span><b>${money(t.sub)}</b></div>${t.chg>0?`<div><span>Order charge</span><b>${money(t.chg)}</b></div>`:""}
<div class="grand"><span>Total</span><span>${money(t.tot)}</span></div>
${o.paid?"":`${t.dep>0?`<div><span>Deposit paid</span><b>−${money(t.dep)}</b></div>`:""}<div class="due"><span>Balance due</span><b>${money(t.bal)}</b></div>`}</div>
${o.paid?`<div style="text-align:right"><span class="stamp">PAID</span></div>`:""}
${!o.paid&&st.payWith?`<div class="pay"><div class="l">How to pay</div>${esc(st.payWith)}</div>`:""}
${st.invoiceNote?`<div class="note">${esc(st.invoiceNote)}</div>`:""}
</div></body></html>`;
}
function printInvoice(o){
  const html=invoiceHtml(o);
  const w=window.open("","_blank");
  if(w){ w.document.open(); w.document.write(html); w.document.close(); return; }
  const f=document.createElement("iframe"); f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(f);
  const d=f.contentWindow.document; d.open(); d.write(html); d.close();
  setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){toast("Couldn't open print");} setTimeout(()=>f.remove(),60000);},600);
}
function ticketText(o){const L=[`${S.settings.shop||"Hippy List"} — WORK TICKET`,`Order HL-${o.ref||""} · ${o.customer.name||""}`];if(o.customer.due)L.push("DUE: "+fmtDate(o.customer.due));L.push("Stage: "+stageOf(o.status).label,"");o.items.forEach(it=>{L.push(`[ ] ${+it.qty||0}x  ${it.garment} (${it.size})`);L.push(`      ${it.technique} · ${it.palette} · ${it.colors} dye colors`);});if(o.notes){L.push("","NOTES: "+o.notes);}return L.join("\n");}
function copyInvoice(o){const t=invoiceText(o);(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast("Invoice copied"),()=>{const ta=document.createElement("textarea");ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");toast("Invoice copied");}catch(e){toast("Copy failed");}ta.remove();});}
function downloadTicket(o){downloadFile(`HippyList-HL${o.ref||""}.txt`,ticketText(o));}
function exportOrders(){const rows=[["Order","Customer","Type","Stage","Pieces","Due","Total","Deposit","Paid","Created"]];S.orders.forEach(o=>rows.push([`HL-${o.ref||""}`,o.customer.name||"",o.customer.kind||"",stageOf(o.status).label,orderPieces(o),o.customer.due||"",orderTotal(o).toFixed(2),(+o.deposit||0).toFixed(2),o.paid?"yes":"no",(o.createdAt||"").slice(0,10)]));downloadFile("hippy-orders.csv",rows.map(r=>r.map(csv).join(",")).join("\n"));toast("Exported");}
function exportCustomers(){const rows=[["Name","Type","Phone","Email","Orders","Lifetime"]];custAgg().forEach(c=>rows.push([c.name,c.kind,c.phone||"",c.email||"",c.orders,c.spent.toFixed(2)]));downloadFile("hippy-customers.csv",rows.map(r=>r.map(csv).join(",")).join("\n"));toast("Exported");}
function downloadFile(name,text){const b=new Blob([text],{type:"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}

/* ─────────── Helpers ─────────── */
function freshItem(){return {garment:S.pricing.blanks[0].name,size:"L",qty:1,technique:S.pricing.techniques[0].name,palette:"Rainbow",colors:3,price:""};}
function freshDraft(){return {customer:{name:"",phone:"",email:"",due:"",kind:"retail"},items:[freshItem()],deposit:"",notes:""};}
function loadDraft(o){editId=o.id;draft={customer:{name:o.customer.name||"",phone:o.customer.phone||"",email:o.customer.email||"",due:o.customer.due||"",kind:o.customer.kind||"retail"},deposit:o.deposit||"",notes:o.notes||"",items:(o.items||[]).map(it=>({garment:it.garment,size:it.size,qty:it.qty,technique:it.technique,palette:it.palette,colors:it.colors,price:it.price==null?"":it.price}))};if(!draft.items.length)draft.items=[freshItem()];}
function nextRef(){return Math.max(1000,...S.orders.map(o=>+o.ref||0))+1;}
function clone(o){return JSON.parse(JSON.stringify(o));}
function num(v){const n=parseFloat(v);return isNaN(n)?0:n;}
function uid(){return "x"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function normalizePricing(p){const b=clone(DEFAULT_PRICING),o=Object.assign(b,p||{});if(!Array.isArray(o.materials)||!o.materials.length)o.materials=clone(DEFAULT_PRICING.materials);if(!Array.isArray(o.blanks)||!o.blanks.length)o.blanks=clone(DEFAULT_PRICING.blanks);if(!Array.isArray(o.techniques)||!o.techniques.length)o.techniques=clone(DEFAULT_PRICING.techniques);return o;}
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
