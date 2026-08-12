import React, {useMemo, useState} from 'react';
import {
  Building2, Users, WalletCards, BellRing, Wrench, Gauge, Search, Plus,
  CheckCircle2, Clock3, Target, TrendingUp, DollarSign, Home, X, Save,
  ArrowRight, CircleDollarSign, Sparkles
} from 'lucide-react';
import {properties, residents, payers, seedPayments} from './data';

const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const pct = n => `${(Number(n)||0).toFixed(1)}%`;
const nav = [
  ['Command Center', Gauge], ['Properties', Building2], ['Residents', Users], ['Payments', WalletCards],
  ['Buy Box', Target], ['Reminders', BellRing], ['Maintenance', Wrench]
];

const PAYMENT_KEY='rental-pilot-payments-v03';
function loadPayments(){
  try{
    const saved=JSON.parse(localStorage.getItem(PAYMENT_KEY)||'null');
    return Array.isArray(saved)?saved:seedPayments;
  }catch{return seedPayments;}
}

export default function App(){
  const [section,setSection]=useState('Command Center');
  const [payments,setPayments]=useState(loadPayments);
  const [query,setQuery]=useState('');
  const [modal,setModal]=useState(null);

  const savePayments = next => { setPayments(next); localStorage.setItem(PAYMENT_KEY,JSON.stringify(next)); };
  const upsertPayment = payment => {
    const month=payment.month||'2026-08';
    const existing=payments.filter(p=>!(p.residentId===payment.residentId&&p.month===month));
    savePayments([...existing,{id:`pay-${Date.now()}`,...payment,month}]);
  };
  const removePayment = id => savePayments(payments.filter(p=>p.id!==id));

  const filtered = residents.filter(r=>r.name.toLowerCase().includes(query.toLowerCase()));
  return <div className="shell">
    <aside>
      <div className="brand"><div className="logo">RP</div><div><strong>Rental Pilot</strong><span>Know your rentals in 10 seconds.</span></div></div>
      <nav>{nav.map(([label,Icon])=><button key={label} className={section===label?'active':''} onClick={()=>setSection(label)}><Icon size={19}/>{label}</button>)}</nav>
      <div className="aside-foot">Athens portfolio workspace<br/><small>Version 0.3 · Buy Box</small></div>
    </aside>
    <main>
      <header><div><h1>{section}</h1><p>{section==='Command Center'?'What needs your attention today?':'Rental Pilot'}</p></div><button className="primary" onClick={()=>setModal('payment')}><Plus size={18}/> Record payment</button></header>
      {section==='Command Center' && <CommandCenter payments={payments} onRecord={r=>setModal(r?{type:'payment',residentId:r.id}:'payment')} onGo={setSection}/>} 
      {section==='Residents' && <Residents query={query} setQuery={setQuery} residents={filtered} payments={payments} onRecord={r=>setModal({type:'payment',residentId:r.id})}/>} 
      {section==='Properties' && <Properties payments={payments}/>} 
      {section==='Payments' && <Payments payments={payments} onRecord={()=>setModal('payment')} onDelete={removePayment}/>} 
      {section==='Buy Box' && <BuyBox/>}
      {section==='Reminders' && <Reminders payments={payments}/>} 
      {section==='Maintenance' && <Empty title="Maintenance is next" text="Requests, vendors, photos, invoices and status history will live here."/>}
    </main>
    {modal && <PaymentModal initialResidentId={typeof modal==='object'?modal.residentId:''} onClose={()=>setModal(null)} onSave={p=>{upsertPayment(p);setModal(null);}}/>}
  </div>
}

function currentMonthPaid(payments,residentId){return payments.filter(p=>p.residentId===residentId&&p.month==='2026-08').reduce((s,p)=>s+Number(p.amount),0)}
function residentBalance(payments,r){return Math.max(0,r.rent-currentMonthPaid(payments,r.id))}
function Stat({label,value,sub,tone}){return <div className={`stat ${tone||''}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>}

function CommandCenter({payments,onRecord,onGo}){
 const scheduled=properties.reduce((s,p)=>s+p.currentRent,0);
 const collected=payments.filter(p=>p.month==='2026-08').reduce((s,p)=>s+Number(p.amount),0);
 const outstanding=Math.max(0,scheduled-collected);
 const portfolioValue=properties.reduce((s,p)=>s+p.currentValue,0);
 const occupied=properties.reduce((s,p)=>s+p.occupied,0), capacity=properties.reduce((s,p)=>s+p.capacity,0);
 const vacancyOpportunity=properties.reduce((s,p)=>s+Math.max(0,p.potentialRent-p.currentRent),0);
 return <>
  <section className="hero-card">
    <div><span className="eyebrow">AUGUST 2026</span><h2>Rent Collection</h2><p>Expected · Collected · Remaining</p></div>
    <div className="hero-numbers"><div><span>Expected</span><b>{money(scheduled)}</b></div><div><span>Collected</span><b>{money(collected)}</b></div><div className="remaining"><span>Remaining</span><b>{money(outstanding)}</b></div></div>
  </section>
  <section className="stats"><Stat label="Portfolio value" value={money(portfolioValue)} sub="3 Athens condos"/><Stat label="Occupancy" value={`${occupied}/${capacity}`} sub={`${Math.round(occupied/capacity*100)}% of bedrooms occupied`}/><Stat label="Monthly opportunity" value={money(vacancyOpportunity)} sub="Potential rent not currently leased" tone="opportunity"/><Stat label="Payments recorded" value={payments.filter(p=>p.month==='2026-08').length} sub="August payment entries"/></section>
  <section className="grid two">
   <div className="card"><div className="card-head"><div><h2>Rent Day</h2><p>Tap a resident to record a payment</p></div><button className="text-button" onClick={onRecord}>Quick record <ArrowRight size={15}/></button></div><RentTable residents={residents} payments={payments} onRecord={r=>onRecord(r)}/></div>
   <div className="card"><div className="card-head"><div><h2>Income Opportunities</h2><p>Where more monthly income is available</p></div></div>
    <div className="opportunity-card"><div className="opp-icon"><TrendingUp/></div><div><strong>Unit 140 · Fill 3 bedrooms</strong><span>Current rent {money(900)} · Potential {money(3600)}</span><b>+{money(2700)}/month</b></div></div>
    <button className="secondary wide" onClick={()=>onGo('Buy Box')}><Target size={17}/> Analyze your next deal</button>
   </div>
  </section>
 </>
}

function RentTable({residents:rs,payments,onRecord}){return <div className="table"><div className="tr th"><span>Resident</span><span>Suite</span><span>Rent</span><span>Status</span></div>{rs.map(r=>{const paid=currentMonthPaid(payments,r.id);const balance=residentBalance(payments,r);return <div className="tr clickable" key={r.id} onClick={()=>onRecord?.(r)}><span><strong>{r.name}</strong><small>{payers.find(p=>p.id===r.payerId)?.name}</small></span><span>{properties.find(p=>p.id===r.propertyId)?.shortName}</span><span>{money(r.rent)}</span><span><button className={balance===0?'paid':paid>0?'partial':'due'}>{balance===0?<CheckCircle2 size={15}/>:<Clock3 size={15}/>} {balance===0?'Paid':paid>0?`${money(balance)} left`:'Due'}</button></span></div>})}</div>}

function Residents({query,setQuery,residents:rs,payments,onRecord}){return <div className="card"><div className="toolbar"><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search residents"/></div></div><RentTable residents={rs} payments={payments} onRecord={onRecord}/></div>}

function Properties({payments}){return <section className="property-grid">{properties.map(p=>{const rs=residents.filter(r=>r.propertyId===p.id);const collected=rs.reduce((s,r)=>s+currentMonthPaid(payments,r.id),0);const fixedMonthly=p.hoaMonthly+p.internetMonthly+p.insuranceAnnual/12+p.taxesAnnual/12;const opportunity=Math.max(0,p.potentialRent-p.currentRent);return <div className="property-card" key={p.id}><div className="property-icon"><Building2/></div><span className={`badge ${p.status==='Healthy'?'occupied':'warning'}`}>{p.status}</span><h2>{p.name}</h2><p>{p.occupied} of {p.capacity} rooms occupied · {p.bedrooms}BR/{p.bathrooms}BA · {p.sqft.toLocaleString()} sq ft</p><div className="property-metrics four"><div><span>Value</span><strong>{money(p.currentValue)}</strong></div><div><span>Current rent</span><strong>{money(p.currentRent)}</strong></div><div><span>Collected</span><strong>{money(collected)}</strong></div><div><span>Fixed costs</span><strong>{money(fixedMonthly)}/mo</strong></div></div>{opportunity>0&&<div className="property-opportunity"><TrendingUp size={17}/><span>Income opportunity</span><strong>+{money(opportunity)}/mo</strong></div>}</div>})}</section>}

function Payments({payments,onRecord,onDelete}){const sorted=[...payments].sort((a,b)=>b.date.localeCompare(a.date));return <div className="card"><div className="card-head"><div><h2>Payment ledger</h2><p>August payments and methods</p></div><button className="secondary" onClick={onRecord}><Plus size={16}/> Add payment</button></div><div className="ledger"><div className="ledger-row ledger-head"><span>Date</span><span>Resident</span><span>Method</span><span>Amount</span><span></span></div>{sorted.map(p=><div className="ledger-row" key={p.id}><span>{p.date}</span><span>{residents.find(r=>r.id===p.residentId)?.name}</span><span>{p.method}</span><strong>{money(p.amount)}</strong><button className="icon-button" onClick={()=>onDelete(p.id)}><X size={15}/></button></div>)}</div></div>}

function Reminders({payments}){const due=residents.filter(r=>residentBalance(payments,r)>0);return <div className="card"><div className="card-head"><div><h2>Friendly reminder queue</h2><p>Billing contacts for residents with an August balance</p></div></div><div className="reminders">{due.map(r=>{const p=payers.find(x=>x.id===r.payerId);const balance=residentBalance(payments,r);return <div className="reminder" key={r.id}><div><strong>{p.name}</strong><span>{r.name} · {money(balance)} remaining</span><small>{p.email}</small></div><button onClick={()=>navigator.clipboard?.writeText(`Hi ${p.name.split(' ')[0]}, this is a friendly reminder that ${money(balance)} for ${r.name}'s August rent is still outstanding. If you've already sent it, please disregard this message. Thank you!`)}>Copy message</button></div>})}{!due.length&&<Empty title="Everyone is paid" text="There are no reminders to send."/>}</div></div>}

function PaymentModal({initialResidentId,onClose,onSave}){
 const [residentId,setResidentId]=useState(initialResidentId||residents[0].id);
 const resident=residents.find(r=>r.id===residentId);
 const [amount,setAmount]=useState(resident?.rent||0);
 const [method,setMethod]=useState('Venmo');
 const [date,setDate]=useState('2026-08-07');
 const changeResident=id=>{setResidentId(id);setAmount(residents.find(r=>r.id===id)?.rent||0)};
 return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><h2>Record Payment</h2><p>Three taps and you're done.</p></div><button className="icon-button" onClick={onClose}><X/></button></div><label>Resident<select value={residentId} onChange={e=>changeResident(e.target.value)}>{residents.map(r=><option value={r.id} key={r.id}>{r.name} · {properties.find(p=>p.id===r.propertyId)?.shortName}</option>)}</select></label><label>Amount<input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Payment method<div className="method-grid">{['Venmo','ACH','Check','Cash'].map(m=><button type="button" className={method===m?'method active':'method'} onClick={()=>setMethod(m)} key={m}>{m}</button>)}</div></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="primary wide save" onClick={()=>onSave({residentId,amount:Number(amount),method,date,month:'2026-08'})}><Save size={17}/> Save Payment</button></div></div>
}

function BuyBox(){
 const [v,setV]=useState({asking:550000,rent:4000,hoa:250,taxes:5000,insurance:700,vacancy:5,reserve:5,down:25,rate:6.75,term:30,targetCash:300,targetCap:6.5});
 const set=(k,val)=>setV(x=>({...x,[k]:Number(val)}));
 const calc=useMemo(()=>{
  const grossAnnual=v.rent*12;
  const effectiveAnnual=grossAnnual*(1-v.vacancy/100);
  const operatingAnnual=v.hoa*12+v.taxes+v.insurance+grossAnnual*(v.reserve/100);
  const noi=Math.max(0,effectiveAnnual-operatingAnnual);
  const capMax=v.targetCap>0?noi/(v.targetCap/100):Infinity;
  const monthlyAvailable=Math.max(0,noi/12-v.targetCash);
  const r=v.rate/100/12, n=v.term*12;
  const maxLoan=r>0?monthlyAvailable*(1-Math.pow(1+r,-n))/r:monthlyAvailable*n;
  const financeMax=(1-v.down/100)>0?maxLoan/(1-v.down/100):Infinity;
  const maxPrice=Math.max(0,Math.min(capMax,financeMax));
  const priceGap=maxPrice-v.asking;
  const capAtAsk=v.asking>0?noi/v.asking*100:0;
  const loanAtAsk=v.asking*(1-v.down/100);
  const paymentAtAsk=r>0?loanAtAsk*r/(1-Math.pow(1+r,-n)):loanAtAsk/n;
  const cashFlowAtAsk=noi/12-paymentAtAsk;
  return {noi,capMax,financeMax,maxPrice,priceGap,capAtAsk,cashFlowAtAsk,paymentAtAsk};
 },[v]);
 const recommendation=calc.priceGap>=0?'BUY ZONE':calc.priceGap>-25000?'NEGOTIATE':'PASS / WAIT';
 return <div className="buybox-layout">
  <div className="card buy-inputs"><div className="card-head"><div><h2>Buy Box Inputs</h2><p>Rental Pilot works backward to your maximum purchase price.</p></div></div>
   <div className="form-grid">
    <Field label="Asking price" value={v.asking} onChange={x=>set('asking',x)} prefix="$"/>
    <Field label="Expected monthly rent" value={v.rent} onChange={x=>set('rent',x)} prefix="$"/>
    <Field label="Monthly HOA" value={v.hoa} onChange={x=>set('hoa',x)} prefix="$"/>
    <Field label="Annual taxes" value={v.taxes} onChange={x=>set('taxes',x)} prefix="$"/>
    <Field label="Annual insurance" value={v.insurance} onChange={x=>set('insurance',x)} prefix="$"/>
    <Field label="Vacancy allowance" value={v.vacancy} onChange={x=>set('vacancy',x)} suffix="%"/>
    <Field label="Repair reserve" value={v.reserve} onChange={x=>set('reserve',x)} suffix="% of rent"/>
    <Field label="Down payment" value={v.down} onChange={x=>set('down',x)} suffix="%"/>
    <Field label="Interest rate" value={v.rate} onChange={x=>set('rate',x)} suffix="%" step="0.05"/>
    <Field label="Loan term" value={v.term} onChange={x=>set('term',x)} suffix="years"/>
    <Field label="Target monthly cash flow" value={v.targetCash} onChange={x=>set('targetCash',x)} prefix="$"/>
    <Field label="Minimum cap rate" value={v.targetCap} onChange={x=>set('targetCap',x)} suffix="%" step="0.1"/>
   </div>
  </div>
  <div className="buy-results">
   <div className={`recommend ${recommendation==='BUY ZONE'?'good':recommendation==='NEGOTIATE'?'mid':'bad'}`}><span>RENTAL PILOT SAYS</span><strong>{recommendation}</strong><small>{calc.priceGap>=0?`${money(calc.priceGap)} below your max buy price`:`${money(Math.abs(calc.priceGap))} above your max buy price`}</small></div>
   <div className="max-price-card"><span>MAXIMUM PURCHASE PRICE</span><strong>{money(calc.maxPrice)}</strong><p>Based on both your target cap rate and target cash flow.</p></div>
   <div className="result-grid"><Result label="Cap-rate max" value={money(calc.capMax)}/><Result label="Cash-flow max" value={money(calc.financeMax)}/><Result label="Cap rate at ask" value={pct(calc.capAtAsk)}/><Result label="Cash flow at ask" value={`${money(calc.cashFlowAtAsk)}/mo`} tone={calc.cashFlowAtAsk>=v.targetCash?'good-text':'bad-text'}/><Result label="NOI" value={`${money(calc.noi)}/yr`}/><Result label="Debt service at ask" value={`${money(calc.paymentAtAsk)}/mo`}/></div>
   <div className="explain"><Sparkles size={18}/><div><strong>How the max price works</strong><p>Rental Pilot calculates the price supported by your minimum cap rate and the price supported by your desired monthly cash flow after estimated debt service. It recommends the lower of the two.</p></div></div>
  </div>
 </div>
}
function Field({label,value,onChange,prefix,suffix,step='1'}){return <label className="field"><span>{label}</span><div className="input-wrap">{prefix&&<b>{prefix}</b>}<input type="number" step={step} value={value} onChange={e=>onChange(e.target.value)}/>{suffix&&<small>{suffix}</small>}</div></label>}
function Result({label,value,tone}){return <div className="result"><span>{label}</span><strong className={tone||''}>{value}</strong></div>}
function Empty({title,text}){return <div className="empty"><CheckCircle2 size={34}/><h2>{title}</h2><p>{text}</p></div>}
