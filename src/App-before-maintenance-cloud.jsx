import React, {useEffect, useMemo, useState} from 'react';
import {
  Building2, Users, WalletCards, BellRing, Wrench, Gauge, Search, Plus,
  CheckCircle2, Clock3, Target, TrendingUp, X, Save, ArrowRight, Sparkles, Receipt, FolderOpen, Upload, FileText
} from 'lucide-react';
import {properties as seedProperties, residents as seedResidents, payers, seedPayments} from './data';
import { supabase } from './lib/supabase';

const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const pct = n => `${(Number(n)||0).toFixed(1)}%`;
const pad = n => String(n).padStart(2,'0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
};
const monthLabel = month => {
  const [y,m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));
};

const nav = [
  ['Command Center', Gauge], ['Properties', Building2], ['Residents', Users], ['Payments', WalletCards],
  ['Expenses', Receipt], ['Documents', FolderOpen], ['Buy Box', Target], ['Reminders', BellRing], ['Maintenance', Wrench]
];

const PAYMENT_KEY='rental-pilot-payments-v04';
const PROPERTY_KEY='rental-pilot-properties-v04';
const RESIDENT_KEY='rental-pilot-residents-v04';
const MAINTENANCE_KEY='rental-pilot-maintenance-v05';
const EXPENSE_KEY='rental-pilot-expenses-v05';
const DOCUMENT_KEY='rental-pilot-documents-v06';

function load(key, fallback, allowEmpty=true){
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(Array.isArray(saved) && (allowEmpty || saved.length)) return saved;
  }catch{}
  return fallback;
}
function loadProperties(){ return load(PROPERTY_KEY,seedProperties,false); }
function loadPayments(){
  const v04=load(PAYMENT_KEY,null);
  if(v04) return v04;
  return load('rental-pilot-payments-v03',seedPayments);
}
function loadResidents(){ return load(RESIDENT_KEY,seedResidents,false); }
function loadMaintenance(){ return load(MAINTENANCE_KEY,[]); }
function loadExpenses(){ return load(EXPENSE_KEY,[]); }
function loadDocuments(){ return load(DOCUMENT_KEY,[]); }

function propertyToDb(p,userId){
  return {
    owner_id:userId,
    name:p.name||'Untitled property',
    address:p.address||p.name||'',
    capacity:Number(p.capacity??p.bedrooms)||0,
    short_name:p.shortName||'',
    purchase_price:Number(p.purchasePrice)||0,
    current_value:Number(p.currentValue)||0,
    bedrooms:Number(p.bedrooms)||0,
    bathrooms:Number(p.bathrooms)||0,
    sqft:Number(p.sqft)||0,
    occupied:Number(p.occupied)||0,
    current_rent:Number(p.currentRent)||0,
    potential_rent:Number(p.potentialRent)||0,
    hoa_monthly:Number(p.hoaMonthly)||0,
    insurance_annual:Number(p.insuranceAnnual)||0,
    taxes_annual:Number(p.taxesAnnual)||0,
    internet_monthly:Number(p.internetMonthly)||0,
    status:p.status||'Opportunity'
  };
}

function propertyFromDb(r,localId){
  return {
    id:localId||r.id,
    cloudId:r.id,
    name:r.name||'Untitled property',
    address:r.address||'',
    shortName:r.short_name||'',
    purchasePrice:Number(r.purchase_price)||0,
    currentValue:Number(r.current_value)||0,
    bedrooms:Number(r.bedrooms)||0,
    bathrooms:Number(r.bathrooms)||0,
    sqft:Number(r.sqft)||0,
    capacity:Number(r.capacity)||Number(r.bedrooms)||0,
    occupied:Number(r.occupied)||0,
    currentRent:Number(r.current_rent)||0,
    potentialRent:Number(r.potential_rent)||0,
    hoaMonthly:Number(r.hoa_monthly)||0,
    insuranceAnnual:Number(r.insurance_annual)||0,
    taxesAnnual:Number(r.taxes_annual)||0,
    internetMonthly:Number(r.internet_monthly)||0,
    status:r.status||'Opportunity'
  };
}


let residentSyncInFlight=false;

function payerForResident(r){
  const seeded=payers.find(p=>p.id===r.payerId);
  return {
    name:r.payerName||seeded?.name||'',
    email:r.payerEmail||seeded?.email||'',
    phone:r.payerPhone||seeded?.phone||''
  };
}

function residentToDb(r,userId,propertyCloudId,billingContactId=null){
  return {
    owner_id:userId,
    property_id:propertyCloudId,
    billing_contact_id:billingContactId,
    name:r.name||'Unnamed resident',
    email:r.email||'',
    phone:r.phone||'',
    monthly_rent:Number(r.rent??r.monthlyRent)||0,
    due_day:Number(r.dueDay)||1,
    active:r.active!==false,
    lease_start:r.leaseStart||null,
    lease_end:r.leaseEnd||null
  };
}

function residentFromDb(r,properties,localExisting=null){
  const property=properties.find(p=>p.cloudId===r.property_id || p.id===r.property_id);
  const billing=r.billing_contacts||null;
  return {
    ...(localExisting||{}),
    id:localExisting?.id||r.id,
    cloudId:r.id,
    cloudBillingContactId:r.billing_contact_id||null,
    propertyId:property?.id||localExisting?.propertyId||'',
    name:r.name||localExisting?.name||'Unnamed resident',
    email:r.email||'',
    phone:r.phone||'',
    rent:Number(r.monthly_rent)||0,
    dueDay:Number(r.due_day)||1,
    active:r.active!==false,
    leaseStart:r.lease_start||localExisting?.leaseStart||'',
    leaseEnd:r.lease_end||localExisting?.leaseEnd||'',
    payerName:billing?.name||localExisting?.payerName||'',
    payerEmail:billing?.email||localExisting?.payerEmail||'',
    payerPhone:billing?.phone||localExisting?.payerPhone||''
  };
}


function paymentToDb(p,userId,residentCloudId){
  return {
    owner_id:userId,
    resident_id:residentCloudId,
    amount:Number(p.amount)||0,
    paid_on:p.date||p.paidOn||todayISO(),
    method:p.method||'Other'
  };
}

function paymentFromDb(r,residents,localExisting=null){
  const resident=residents.find(x=>x.cloudId===r.resident_id || x.id===r.resident_id);
  const paidOn=r.paid_on||todayISO();
  return {
    ...(localExisting||{}),
    id:localExisting?.id||r.id,
    cloudId:r.id,
    residentId:resident?.id||localExisting?.residentId||'',
    amount:Number(r.amount)||0,
    date:paidOn,
    method:r.method||'Other',
    month:String(paidOn).slice(0,7)
  };
}


function expenseToDb(e,userId,propertyCloudId){
  return {
    owner_id:userId,
    property_id:propertyCloudId,
    amount:Number(e.amount)||0,
    category:e.category||'Other',
    vendor:e.vendor||'',
    incurred_on:e.date||e.incurredOn||todayISO(),
    notes:e.notes||''
  };
}

function expenseFromDb(r,properties,localExisting=null){
  const property=properties.find(p=>p.cloudId===r.property_id || p.id===r.property_id);
  return {
    ...(localExisting||{}),
    id:localExisting?.id||r.id,
    cloudId:r.id,
    propertyId:property?.id||localExisting?.propertyId||'',
    amount:Number(r.amount)||0,
    category:r.category||'Other',
    vendor:r.vendor||'',
    date:r.incurred_on||todayISO(),
    notes:r.notes||''
  };
}


function maintenanceToDb(m,userId,propertyCloudId){
  return {
    owner_id:userId,
    property_id:propertyCloudId,
    title:m.title||'Maintenance item',
    notes:m.notes||'',
    vendor:m.vendor||'',
    estimated_cost:Number(m.estimatedCost)||0,
    actual_cost:Number(m.actualCost)||0,
    date_paid:m.datePaid||null,
    payment_method:m.paymentMethod||'',
    status:m.status||'Open'
  };
}

function maintenanceFromDb(r,properties,localExisting=null){
  const property=properties.find(p=>p.cloudId===r.property_id || p.id===r.property_id);
  return {
    ...(localExisting||{}),
    id:localExisting?.id||r.id,
    cloudId:r.id,
    propertyId:property?.id||localExisting?.propertyId||'',
    title:r.title||'Maintenance item',
    notes:r.notes||'',
    vendor:r.vendor||'',
    estimatedCost:Number(r.estimated_cost)||0,
    actualCost:Number(r.actual_cost)||0,
    datePaid:r.date_paid||'',
    paymentMethod:r.payment_method||'',
    status:r.status||'Open',
    createdAt:String(r.created_at||todayISO()).slice(0,10)
  };
}

export default function App(){
  const [section,setSection]=useState('Command Center');
  const [selectedPropertyId,setSelectedPropertyId]=useState(null);
  const [session,setSession]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  const [payments,setPayments]=useState(loadPayments);
  const [properties,setProperties]=useState(loadProperties);
  const [residents,setResidents]=useState(loadResidents);
  const [maintenance,setMaintenance]=useState(loadMaintenance);
  const [expenses,setExpenses]=useState(loadExpenses);
  const [documents,setDocuments]=useState(loadDocuments);
  const [query,setQuery]=useState('');
  const [modal,setModal]=useState(null);
  const [month,setMonth]=useState(currentMonthKey());

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthReady(true);});
    const {data:listener}=supabase.auth.onAuthStateChange((_event,nextSession)=>{setSession(nextSession);setAuthReady(true);});
    return ()=>listener.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session?.user?.id) return;
    let cancelled=false;

    const syncProperties=async()=>{
      const {data:rows,error}=await supabase
        .from('properties')
        .select('*')
        .order('created_at',{ascending:true});
      if(error) throw error;

      const local=loadProperties();

      if((rows||[]).length===0 && local.length){
        const migrated=[];
        for(const p of local){
          const {data:created,error:createError}=await supabase
            .from('properties')
            .insert(propertyToDb(p,session.user.id))
            .select()
            .single();
          if(createError) throw createError;
          migrated.push({...p,cloudId:created.id});
        }
        if(!cancelled) saveProperties(migrated);
        return;
      }

      if((rows||[]).length){
        const used=new Set();
        const merged=local.map(p=>{
          const match=rows.find(r=>r.id===p.cloudId || r.name===p.name);
          if(!match) return p;
          used.add(match.id);
          return {...propertyFromDb(match,p.id),id:p.id,cloudId:match.id};
        });
        rows.forEach(r=>{
          if(!used.has(r.id)) merged.push(propertyFromDb(r,r.id));
        });
        if(!cancelled) saveProperties(merged);
      }
    };

    syncProperties().catch(err=>{
      console.error('Property cloud sync failed:',err);
      alert(`Property cloud sync failed: ${err.message||err}`);
    });

    return ()=>{cancelled=true;};
  },[session?.user?.id]);

  useEffect(()=>{
    if(!session?.user?.id) return;
    if(residentSyncInFlight) return;

    const local=loadResidents();
    if(!local.length) return;

    // Wait until cloud property IDs are available so resident foreign keys are correct.
    const localPropertyIds=[...new Set(local.map(r=>r.propertyId).filter(Boolean))];
    const propertyMapReady=localPropertyIds.every(id=>properties.find(p=>p.id===id)?.cloudId);
    if(!propertyMapReady) return;

    let cancelled=false;
    residentSyncInFlight=true;

    const syncResidents=async()=>{
      try{
        const {data:rows,error}=await supabase
          .from('residents')
          .select('*, billing_contacts(*)')
          .order('created_at',{ascending:true});
        if(error) throw error;

        if((rows||[]).length===0){
          const migrated=[];
          for(const r of local){
            const property=properties.find(p=>p.id===r.propertyId);
            if(!property?.cloudId) continue;

            const payer=payerForResident(r);
            let billingContactId=null;

            if(payer.name || payer.email || payer.phone){
              const {data:contact,error:contactError}=await supabase
                .from('billing_contacts')
                .insert({
                  owner_id:session.user.id,
                  name:payer.name||r.name,
                  relationship:'Parent / Payer',
                  email:payer.email||'',
                  phone:payer.phone||''
                })
                .select()
                .single();
              if(contactError) throw contactError;
              billingContactId=contact.id;
            }

            const {data:created,error:createError}=await supabase
              .from('residents')
              .insert(residentToDb(r,session.user.id,property.cloudId,billingContactId))
              .select('*, billing_contacts(*)')
              .single();
            if(createError) throw createError;

            migrated.push({
              ...r,
              cloudId:created.id,
              cloudBillingContactId:billingContactId,
              payerName:payer.name||r.payerName||'',
              payerEmail:payer.email||r.payerEmail||'',
              payerPhone:payer.phone||r.payerPhone||''
            });
          }
          if(!cancelled) saveResidents(migrated);
          return;
        }

        const used=new Set();
        const merged=local.map(localResident=>{
          const localProperty=properties.find(p=>p.id===localResident.propertyId);
          const match=rows.find(row=>
            row.id===localResident.cloudId ||
            (row.name===localResident.name && row.property_id===localProperty?.cloudId)
          );
          if(!match) return localResident;
          used.add(match.id);
          return residentFromDb(match,properties,localResident);
        });

        rows.forEach(row=>{
          if(!used.has(row.id)) merged.push(residentFromDb(row,properties));
        });

        if(!cancelled) saveResidents(merged);
      } finally {
        residentSyncInFlight=false;
      }
    };

    syncResidents().catch(err=>{
      residentSyncInFlight=false;
      console.error('Resident cloud sync failed:',err);
      alert(`Resident cloud sync failed: ${err.message||err}`);
    });

    return ()=>{cancelled=true;};
  },[session?.user?.id,properties]);

  useEffect(()=>{
    if(!session?.user?.id) return;

    const local=loadPayments();
    if(!local.length) return;

    const residentIds=[...new Set(local.map(p=>p.residentId).filter(Boolean))];
    const residentMapReady=residentIds.every(id=>residents.find(r=>r.id===id)?.cloudId);
    if(!residentMapReady) return;

    let cancelled=false;

    const syncPayments=async()=>{
      const {data:rows,error}=await supabase
        .from('payments')
        .select('*')
        .order('paid_on',{ascending:true});
      if(error) throw error;

      if((rows||[]).length===0){
        const migrated=[];
        for(const p of local){
          const resident=residents.find(r=>r.id===p.residentId);
          if(!resident?.cloudId) continue;

          const {data:created,error:createError}=await supabase
            .from('payments')
            .insert(paymentToDb(p,session.user.id,resident.cloudId))
            .select()
            .single();
          if(createError) throw createError;
          migrated.push({...p,cloudId:created.id});
        }
        if(!cancelled) savePayments(migrated);
        return;
      }

      const used=new Set();
      const merged=local.map(localPayment=>{
        const resident=residents.find(r=>r.id===localPayment.residentId);
        const match=rows.find(row=>
          row.id===localPayment.cloudId ||
          (
            row.resident_id===resident?.cloudId &&
            Number(row.amount)===Number(localPayment.amount) &&
            row.paid_on===(localPayment.date||localPayment.paidOn)
          )
        );
        if(!match) return localPayment;
        used.add(match.id);
        return paymentFromDb(match,residents,localPayment);
      });

      rows.forEach(row=>{
        if(!used.has(row.id)) merged.push(paymentFromDb(row,residents));
      });

      if(!cancelled) savePayments(merged);
    };

    syncPayments().catch(err=>{
      console.error('Payment cloud sync failed:',err);
      alert(`Payment cloud sync failed: ${err.message||err}`);
    });

    return ()=>{cancelled=true;};
  },[session?.user?.id,residents]);

  const savePayments = next => { setPayments(next); localStorage.setItem(PAYMENT_KEY,JSON.stringify(next)); };
  const saveProperties = next => { setProperties(next); localStorage.setItem(PROPERTY_KEY,JSON.stringify(next)); };
  const saveResidents = next => { setResidents(next); localStorage.setItem(RESIDENT_KEY,JSON.stringify(next)); };
  useEffect(()=>{
    if(!session?.user?.id) return;

    const local=loadMaintenance();
    if(!local.length) return;

    const propertyIds=[...new Set(local.map(m=>m.propertyId).filter(Boolean))];
    const propertyMapReady=propertyIds.every(id=>properties.find(p=>p.id===id)?.cloudId);
    if(!propertyMapReady) return;

    let cancelled=false;

    const syncMaintenance=async()=>{
      const {data:rows,error}=await supabase
        .from('maintenance')
        .select('*')
        .order('created_at',{ascending:true});
      if(error) throw error;

      if((rows||[]).length===0){
        const migrated=[];
        for(const m of local){
          const property=properties.find(p=>p.id===m.propertyId);
          if(!property?.cloudId) continue;

          const {data:created,error:createError}=await supabase
            .from('maintenance')
            .insert(maintenanceToDb(m,session.user.id,property.cloudId))
            .select()
            .single();
          if(createError) throw createError;

          migrated.push({...m,cloudId:created.id});
        }
        if(!cancelled) saveMaintenance(migrated);
        return;
      }

      const used=new Set();
      const merged=local.map(localItem=>{
        const property=properties.find(p=>p.id===localItem.propertyId);
        const match=rows.find(row=>
          row.id===localItem.cloudId ||
          (
            row.property_id===property?.cloudId &&
            row.title===localItem.title &&
            Number(row.actual_cost||0)===Number(localItem.actualCost||0)
          )
        );
        if(!match) return localItem;
        used.add(match.id);
        return maintenanceFromDb(match,properties,localItem);
      });

      rows.forEach(row=>{
        if(!used.has(row.id)) merged.push(maintenanceFromDb(row,properties));
      });

      if(!cancelled) saveMaintenance(merged);
    };

    syncMaintenance().catch(err=>{
      console.error('Maintenance cloud sync failed:',err);
      alert(`Maintenance cloud sync failed: ${err.message||err}`);
    });

    return ()=>{cancelled=true;};
  },[session?.user?.id,properties]);

  const saveMaintenance = next => { setMaintenance(next); localStorage.setItem(MAINTENANCE_KEY,JSON.stringify(next)); };
  useEffect(()=>{
    if(!session?.user?.id) return;

    const local=loadExpenses();
    if(!local.length) return;

    const propertyIds=[...new Set(local.map(e=>e.propertyId).filter(Boolean))];
    const propertyMapReady=propertyIds.every(id=>properties.find(p=>p.id===id)?.cloudId);
    if(!propertyMapReady) return;

    let cancelled=false;

    const syncExpenses=async()=>{
      const {data:rows,error}=await supabase
        .from('expenses')
        .select('*')
        .order('incurred_on',{ascending:true});
      if(error) throw error;

      if((rows||[]).length===0){
        const migrated=[];
        for(const e of local){
          const property=properties.find(p=>p.id===e.propertyId);
          if(!property?.cloudId) continue;

          const {data:created,error:createError}=await supabase
            .from('expenses')
            .insert(expenseToDb(e,session.user.id,property.cloudId))
            .select()
            .single();
          if(createError) throw createError;

          migrated.push({...e,cloudId:created.id});
        }
        if(!cancelled) saveExpenses(migrated);
        return;
      }

      const used=new Set();
      const merged=local.map(localExpense=>{
        const property=properties.find(p=>p.id===localExpense.propertyId);
        const match=rows.find(row=>
          row.id===localExpense.cloudId ||
          (
            row.property_id===property?.cloudId &&
            Number(row.amount)===Number(localExpense.amount) &&
            row.incurred_on===(localExpense.date||localExpense.incurredOn) &&
            (row.category||'')===(localExpense.category||'')
          )
        );
        if(!match) return localExpense;
        used.add(match.id);
        return expenseFromDb(match,properties,localExpense);
      });

      rows.forEach(row=>{
        if(!used.has(row.id)) merged.push(expenseFromDb(row,properties));
      });

      if(!cancelled) saveExpenses(merged);
    };

    syncExpenses().catch(err=>{
      console.error('Expense cloud sync failed:',err);
      alert(`Expense cloud sync failed: ${err.message||err}`);
    });

    return ()=>{cancelled=true;};
  },[session?.user?.id,properties]);

  const saveExpenses = next => { setExpenses(next); localStorage.setItem(EXPENSE_KEY,JSON.stringify(next)); };
  const saveDocuments = next => { setDocuments(next); localStorage.setItem(DOCUMENT_KEY,JSON.stringify(next)); };

  const addProperty = property => {
    const id=`property-${Date.now()}`;
    const capacity=Number(property.bedrooms)||0;
    const occupied=Math.min(Number(property.occupied)||0,capacity);
    const currentRent=Number(property.currentRent)||0;
    const potentialRent=Number(property.potentialRent)||currentRent;
    const nextProperty={...property,id,capacity,occupied,currentRent,potentialRent,status:occupied>=capacity&&capacity>0?'Healthy':'Opportunity'};
    saveProperties([...properties,nextProperty]);

    if(session?.user?.id){
      supabase.from('properties')
        .insert(propertyToDb(nextProperty,session.user.id))
        .select()
        .single()
        .then(({data,error})=>{
          if(error) throw error;
          saveProperties([...properties,{...nextProperty,cloudId:data.id}]);
        })
        .catch(err=>{
          console.error('Property cloud save failed:',err);
          alert(`Property saved on this device, but cloud save failed: ${err.message||err}`);
        });
    }
  };

  const updateProperty = (id,property) => {
    const existing=properties.find(p=>p.id===id);
    const capacity=Number(property.bedrooms)||0;
    const occupied=Math.min(Number(property.occupied)||0,capacity);
    const currentRent=Number(property.currentRent)||0;
    const potentialRent=Number(property.potentialRent)||currentRent;
    const updated={...existing,...property,capacity,occupied,currentRent,potentialRent,status:occupied>=capacity&&capacity>0?'Healthy':'Opportunity'};
    saveProperties(properties.map(p=>p.id===id?updated:p));

    if(session?.user?.id){
      const payload=propertyToDb(updated,session.user.id);
      const cloudAction=existing?.cloudId
        ? supabase.from('properties').update(payload).eq('id',existing.cloudId).select().single()
        : supabase.from('properties').insert(payload).select().single();

      cloudAction.then(({data,error})=>{
        if(error) throw error;
        if(!existing?.cloudId && data?.id){
          saveProperties(properties.map(p=>p.id===id?{...updated,cloudId:data.id}:p));
        }
      }).catch(err=>{
        console.error('Property cloud update failed:',err);
        alert(`Property updated on this device, but cloud update failed: ${err.message||err}`);
      });
    }
  };
  const addResident = resident => {
    const id=`resident-${Date.now()}`;
    const next={...resident,id,rent:Number(resident.rent)||0,dueDay:Number(resident.dueDay)||1,active:true};
    saveResidents([...residents,next]);

    if(session?.user?.id){
      const property=properties.find(p=>p.id===next.propertyId);
      if(!property?.cloudId){
        alert('Resident saved on this device, but the property is not cloud-connected yet.');
        return;
      }

      (async()=>{
        try{
          const payer=payerForResident(next);
          let billingContactId=null;

          if(payer.name || payer.email || payer.phone){
            const {data:contact,error:contactError}=await supabase
              .from('billing_contacts')
              .insert({
                owner_id:session.user.id,
                name:payer.name||next.name,
                relationship:'Parent / Payer',
                email:payer.email||'',
                phone:payer.phone||''
              })
              .select()
              .single();
            if(contactError) throw contactError;
            billingContactId=contact.id;
          }

          const {data:created,error:createError}=await supabase
            .from('residents')
            .insert(residentToDb(next,session.user.id,property.cloudId,billingContactId))
            .select()
            .single();
          if(createError) throw createError;

          saveResidents([...residents,{
            ...next,
            cloudId:created.id,
            cloudBillingContactId:billingContactId,
            payerName:payer.name||next.payerName||'',
            payerEmail:payer.email||next.payerEmail||'',
            payerPhone:payer.phone||next.payerPhone||''
          }]);
        }catch(err){
          console.error('Resident cloud save failed:',err);
          alert(`Resident saved on this device, but cloud save failed: ${err.message||err}`);
        }
      })();
    }
  };

  const removeResident = id => {
    if(!window.confirm('Remove this resident from Rental Pilot? Existing payment history will remain.')) return;
    const existing=residents.find(r=>r.id===id);
    saveResidents(residents.filter(r=>r.id!==id));

    if(session?.user?.id && existing?.cloudId){
      (async()=>{
        try{
          const {error}=await supabase.from('residents').delete().eq('id',existing.cloudId);
          if(error) throw error;
          if(existing.cloudBillingContactId){
            const {error:contactError}=await supabase.from('billing_contacts').delete().eq('id',existing.cloudBillingContactId);
            if(contactError) console.warn('Billing contact cleanup failed:',contactError);
          }
        }catch(err){
          console.error('Resident cloud delete failed:',err);
          alert(`Resident was removed on this device, but cloud delete failed: ${err.message||err}`);
        }
      })();
    }
  };
  const addMaintenance = item => {
    const next={id:`maint-${Date.now()}`,status:'Open',createdAt:todayISO(),estimatedCost:Number(item.estimatedCost)||0,actualCost:Number(item.actualCost)||0,...item};
    saveMaintenance([next,...maintenance]);

    if(session?.user?.id){
      const property=properties.find(p=>p.id===next.propertyId);
      if(!property?.cloudId){
        alert('Maintenance item saved on this device, but the property is not cloud-connected yet.');
        return;
      }

      supabase.from('maintenance')
        .insert(maintenanceToDb(next,session.user.id,property.cloudId))
        .select()
        .single()
        .then(({data,error})=>{
          if(error) throw error;
          saveMaintenance([{...next,cloudId:data.id},...maintenance]);
        })
        .catch(err=>{
          console.error('Maintenance cloud save failed:',err);
          alert(`Maintenance item saved on this device, but cloud save failed: ${err.message||err}`);
        });
    }
  };

  const updateMaintenance = (id,status) => {
    const existing=maintenance.find(m=>m.id===id);
    const updated=maintenance.map(m=>m.id===id?{...m,status}:m);
    saveMaintenance(updated);

    if(session?.user?.id && existing?.cloudId){
      supabase.from('maintenance')
        .update({status})
        .eq('id',existing.cloudId)
        .then(({error})=>{
          if(error) throw error;
        })
        .catch(err=>{
          console.error('Maintenance cloud update failed:',err);
          alert(`Maintenance status changed on this device, but cloud update failed: ${err.message||err}`);
        });
    }
  };

  const removeMaintenance = id => {
    const existing=maintenance.find(m=>m.id===id);
    saveMaintenance(maintenance.filter(m=>m.id!==id));

    if(session?.user?.id && existing?.cloudId){
      supabase.from('maintenance')
        .delete()
        .eq('id',existing.cloudId)
        .then(({error})=>{
          if(error) throw error;
        })
        .catch(err=>{
          console.error('Maintenance cloud delete failed:',err);
          alert(`Maintenance item was removed on this device, but cloud delete failed: ${err.message||err}`);
        });
    }
  };
  const addExpense = expense => {
    const next={id:`exp-${Date.now()}`,...expense,amount:Number(expense.amount)||0};
    saveExpenses([next,...expenses]);

    if(session?.user?.id){
      const property=properties.find(p=>p.id===next.propertyId);
      if(!property?.cloudId){
        alert('Expense saved on this device, but the property is not cloud-connected yet.');
        return;
      }

      supabase.from('expenses')
        .insert(expenseToDb(next,session.user.id,property.cloudId))
        .select()
        .single()
        .then(({data,error})=>{
          if(error) throw error;
          saveExpenses([{...next,cloudId:data.id},...expenses]);
        })
        .catch(err=>{
          console.error('Expense cloud save failed:',err);
          alert(`Expense saved on this device, but cloud save failed: ${err.message||err}`);
        });
    }
  };

  const removeExpense = id => {
    const existing=expenses.find(e=>e.id===id);
    saveExpenses(expenses.filter(e=>e.id!==id));

    if(session?.user?.id && existing?.cloudId){
      supabase.from('expenses')
        .delete()
        .eq('id',existing.cloudId)
        .then(({error})=>{
          if(error) throw error;
        })
        .catch(err=>{
          console.error('Expense cloud delete failed:',err);
          alert(`Expense was removed on this device, but cloud delete failed: ${err.message||err}`);
        });
    }
  };
  const addDocument = async doc => {
    if(!session?.user) throw new Error('Please sign in first.');
    const id=`doc-${Date.now()}`;
    let storagePath='';
    if(doc.file){
      const safe=doc.file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      storagePath=`${session.user.id}/${Date.now()}-${safe}`;
      const {error}=await supabase.storage.from('rental-pilot-documents').upload(storagePath,doc.file,{upsert:false,contentType:doc.file.type||undefined});
      if(error) throw error;
    }
    const clean={...doc};
    delete clean.file;
    saveDocuments([{id,uploadedAt:todayISO(),storagePath,...clean},...documents]);
  };
  const openDocument = async doc => {
    if(!doc.storagePath) return alert('This record was created before cloud uploads were connected.');
    const {data,error}=await supabase.storage.from('rental-pilot-documents').createSignedUrl(doc.storagePath,120);
    if(error) return alert(error.message);
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  };
  const removeDocument = async id => {
    const doc=documents.find(d=>d.id===id);
    if(!doc) return;
    if(!window.confirm(`Delete ${doc.name}?`)) return;
    if(doc.storagePath){
      const {error}=await supabase.storage.from('rental-pilot-documents').remove([doc.storagePath]);
      if(error) return alert(error.message);
    }
    saveDocuments(documents.filter(d=>d.id!==id));
  };

  const upsertPayment = payment => {
    const paymentMonth=payment.month||month;
    const next={id:`pay-${Date.now()}`,...payment,month:paymentMonth};
    savePayments([...payments,next]);

    if(session?.user?.id){
      const resident=residents.find(r=>r.id===next.residentId);
      if(!resident?.cloudId){
        alert('Payment saved on this device, but the resident is not cloud-connected yet.');
        return;
      }

      supabase.from('payments')
        .insert(paymentToDb(next,session.user.id,resident.cloudId))
        .select()
        .single()
        .then(({data,error})=>{
          if(error) throw error;
          savePayments([...payments,{...next,cloudId:data.id}]);
        })
        .catch(err=>{
          console.error('Payment cloud save failed:',err);
          alert(`Payment saved on this device, but cloud save failed: ${err.message||err}`);
        });
    }
  };

  const removePayment = id => {
    const existing=payments.find(p=>p.id===id);
    savePayments(payments.filter(p=>p.id!==id));

    if(session?.user?.id && existing?.cloudId){
      supabase.from('payments')
        .delete()
        .eq('id',existing.cloudId)
        .then(({error})=>{
          if(error) throw error;
        })
        .catch(err=>{
          console.error('Payment cloud delete failed:',err);
          alert(`Payment was removed on this device, but cloud delete failed: ${err.message||err}`);
        });
    }
  };

  const filtered = residents.filter(r=>r.name.toLowerCase().includes(query.toLowerCase()));

  if(!authReady) return <div style={{padding:40,fontFamily:'system-ui'}}>Loading Rental Pilot…</div>;
  if(!session) return <AuthGate/>;
  return <div className="shell">
    <aside>
      <div className="brand"><div className="logo">RP</div><div><strong>Rental Pilot</strong><span>Know your rentals in 10 seconds.</span></div></div>
      <nav>{nav.map(([label,Icon])=><button key={label} className={section===label?'active':''} onClick={()=>{setSection(label);if(label!=='Properties')setSelectedPropertyId(null)}}><Icon size={19}/>{label}</button>)}</nav>
      <div className="aside-foot">Portfolio workspace<br/><small>Version 1.4 · Cloud Maintenance</small><br/><button className="text-button" style={{marginTop:10}} onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
    </aside>
    <main>
      <header>
        <div><h1>{section}</h1><p>{section==='Command Center'?'What needs your attention today?':'Rental Pilot'}</p></div>
        <button className="primary" onClick={()=>setModal({type:'payment'})}><Plus size={18}/> Record payment</button>
      </header>

      {(section==='Command Center'||section==='Payments'||section==='Expenses'||section==='Reminders') &&
        <MonthPicker month={month} setMonth={setMonth}/>}

      {section==='Command Center' && <CommandCenter properties={properties} residents={residents} payments={payments} expenses={expenses} maintenance={maintenance} month={month} onRecord={r=>setModal({type:'payment',residentId:r?.id})} onGo={setSection}/>}
      {section==='Residents' && <Residents properties={properties} query={query} setQuery={setQuery} residents={filtered} payments={payments} month={month} onRecord={r=>setModal({type:'payment',residentId:r.id})} onAdd={()=>setModal({type:'resident'})} onDelete={removeResident}/>}
      {section==='Properties' && (selectedPropertyId
        ? <PropertyDetail
            property={properties.find(p=>p.id===selectedPropertyId)}
            residents={residents}
            payments={payments}
            expenses={expenses}
            maintenance={maintenance}
            documents={documents}
            month={month}
            onBack={()=>setSelectedPropertyId(null)}
            onRecord={r=>setModal({type:'payment',residentId:r.id})}
            onEdit={p=>setModal({type:'property-edit',property:p})}
            onOpenDocument={openDocument}
          />
        : <Properties
            properties={properties}
            residents={residents}
            payments={payments}
            month={month}
            onAdd={()=>setModal({type:'property'})}
            onOpen={p=>setSelectedPropertyId(p.id)}
          />)}
      {section==='Payments' && <Payments residents={residents} properties={properties} payments={payments} month={month} onRecord={()=>setModal({type:'payment'})} onDelete={removePayment}/>}
      {section==='Expenses' && <Expenses expenses={expenses} properties={properties} month={month} onAdd={()=>setModal({type:'expense'})} onDelete={removeExpense}/>}
      {section==='Documents' && <Documents documents={documents} properties={properties} residents={residents} onAdd={()=>setModal({type:'document'})} onDelete={removeDocument} onOpen={openDocument}/>}
      {section==='Buy Box' && <BuyBox/>}
      {section==='Reminders' && <Reminders residents={residents} payments={payments} month={month}/>}
      {section==='Maintenance' && <Maintenance maintenance={maintenance} properties={properties} onAdd={()=>setModal({type:'maintenance'})} onStatus={updateMaintenance} onDelete={removeMaintenance}/>}

    </main>

    {modal?.type==='property' && <PropertyModal mode="add" onClose={()=>setModal(null)} onSave={p=>{addProperty(p);setModal(null);setSection('Properties');}}/>}
    {modal?.type==='property-edit' && <PropertyModal mode="edit" initial={modal.property} onClose={()=>setModal(null)} onSave={p=>{updateProperty(modal.property.id,p);setModal(null);}}/>}
    {modal?.type==='resident' && <ResidentModal properties={properties} onClose={()=>setModal(null)} onSave={r=>{addResident(r);setModal(null);setSection('Residents');}}/>}
    {modal?.type==='payment' && <PaymentModal properties={properties} residents={residents} month={month} initialResidentId={modal.residentId||''} onClose={()=>setModal(null)} onSave={p=>{upsertPayment(p);setModal(null);}}/>}
    {modal?.type==='maintenance' && <MaintenanceModal properties={properties} onClose={()=>setModal(null)} onSave={m=>{addMaintenance(m); if(Number(m.actualCost)>0){addExpense({propertyId:m.propertyId,category:'Repairs & Maintenance',amount:Number(m.actualCost),date:m.datePaid||todayISO(),vendor:m.vendor||'',method:m.paymentMethod||'',notes:m.title});} setModal(null);}}/>}
    {modal?.type==='expense' && <ExpenseModal properties={properties} onClose={()=>setModal(null)} onSave={e=>{addExpense(e);setModal(null);setSection('Expenses');}}/>}
    {modal?.type==='document' && <DocumentModal properties={properties} residents={residents} onClose={()=>setModal(null)} onSave={async d=>{try{await addDocument(d);setModal(null);setSection('Documents');}catch(err){alert(err.message||'Upload failed');}}}/>}
  </div>
}


function AuthGate(){
  const [mode,setMode]=useState('signin');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const submit=async()=>{
    setBusy(true);setMessage('');
    try{
      if(mode==='signin'){
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error) throw error;
      }else{
        const {data,error}=await supabase.auth.signUp({email,password});
        if(error) throw error;
        if(!data.session) setMessage('Account created. Check your email for the confirmation message, then come back and sign in.');
      }
    }catch(e){setMessage(e.message||'Unable to sign in.');}
    finally{setBusy(false);}
  };
  return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f4f7fb',fontFamily:'system-ui'}}>
    <div className="card" style={{width:'min(430px,92vw)',padding:28}}>
      <div className="brand" style={{marginBottom:24}}><div className="logo">RP</div><div><strong>Rental Pilot</strong><span>Secure property workspace</span></div></div>
      <h2>{mode==='signin'?'Sign in':'Create your Rental Pilot login'}</h2>
      <p>Your leases, receipts and property documents remain in a private cloud bucket.</p>
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signin'?'current-password':'new-password'}/></label>
      {message&&<p style={{marginTop:12}}>{message}</p>}
      <button className="primary wide save" disabled={busy||!email||password.length<6} onClick={submit}>{busy?'Please wait…':mode==='signin'?'Sign in':'Create account'}</button>
      <button className="text-button" style={{marginTop:14}} onClick={()=>{setMode(mode==='signin'?'signup':'signin');setMessage('')}}>{mode==='signin'?'First time? Create account':'Already have an account? Sign in'}</button>
    </div>
  </div>
}

function MonthPicker({month,setMonth}){
  return <div className="card" style={{marginBottom:16,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
    <strong>Rent month</strong>
    <input type="month" value={month} onChange={e=>setMonth(e.target.value)} />
    <span>{monthLabel(month)}</span>
  </div>
}
function paidForMonth(payments,residentId,month){return payments.filter(p=>p.residentId===residentId&&p.month===month).reduce((s,p)=>s+Number(p.amount),0)}
function residentBalance(payments,r,month){return Math.max(0,Number(r.rent||0)-paidForMonth(payments,r.id,month))}
function Stat({label,value,sub,tone}){return <div className={`stat ${tone||''}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>}

function CommandCenter({properties,residents,payments,expenses,maintenance,month,onRecord,onGo}){
  const scheduled=residents.reduce((s,r)=>s+Number(r.rent||0),0);
  const collected=payments.filter(p=>p.month===month).reduce((s,p)=>s+Number(p.amount),0);
  const outstanding=Math.max(0,scheduled-collected);
  const monthExpenses=expenses.filter(e=>(e.date||'').startsWith(month)).reduce((s,e)=>s+Number(e.amount||0),0);
  const netCash=Math.max(0,collected-monthExpenses);
  const openMaintenance=maintenance.filter(m=>m.status!=='Completed').length;
  const portfolioValue=properties.reduce((s,p)=>s+Number(p.currentValue||0),0);
  const capacity=properties.reduce((s,p)=>s+Number(p.capacity||p.bedrooms||0),0);
  const occupied=residents.length;
  const vacancyOpportunity=properties.reduce((s,p)=>s+Math.max(0,Number(p.potentialRent||0)-Number(p.currentRent||0)),0);
  const opportunities=properties.map(p=>({...p,gap:Math.max(0,Number(p.potentialRent||0)-Number(p.currentRent||0))})).filter(p=>p.gap>0).sort((a,b)=>b.gap-a.gap);
  return <>
    <section className="hero-card">
      <div><span className="eyebrow">{monthLabel(month).toUpperCase()}</span><h2>Rent Collection</h2><p>Expected · Collected · Remaining</p></div>
      <div className="hero-numbers"><div><span>Expected</span><b>{money(scheduled)}</b></div><div><span>Collected</span><b>{money(collected)}</b></div><div className="remaining"><span>Remaining</span><b>{money(outstanding)}</b></div></div>
    </section>
    <section className="stats">
      <Stat label="Portfolio value" value={money(portfolioValue)} sub={`${properties.length} properties`}/>
      <Stat label="Occupancy" value={`${occupied}/${capacity||0}`} sub={capacity?`${Math.round(occupied/capacity*100)}% of bedrooms occupied`:'Add bedroom capacity'}/>
      <Stat label="Monthly expenses" value={money(monthExpenses)} sub={`${monthLabel(month)} expenses`}/>
      <Stat label="Net collected" value={money(netCash)} sub="Collected less recorded expenses"/>
      <Stat label="Open maintenance" value={openMaintenance} sub="Items needing attention"/>
      <Stat label="Monthly opportunity" value={money(vacancyOpportunity)} sub="Potential rent not currently leased" tone="opportunity"/>
    </section>
    <section className="grid two">
      <div className="card"><div className="card-head"><div><h2>Rent Day</h2><p>Tap a resident to record a payment</p></div><button className="text-button" onClick={()=>onRecord()}><span>Quick record</span> <ArrowRight size={15}/></button></div><RentTable properties={properties} residents={residents} payments={payments} month={month} onRecord={onRecord}/></div>
      <div className="card"><div className="card-head"><div><h2>Income Opportunities</h2><p>Where more monthly income is available</p></div></div>
        {opportunities.slice(0,3).map(p=><div className="opportunity-card" key={p.id}><div className="opp-icon"><TrendingUp/></div><div><strong>{p.shortName||p.name}</strong><span>Current {money(p.currentRent)} · Potential {money(p.potentialRent)}</span><b>+{money(p.gap)}/month</b></div></div>)}
        {!opportunities.length&&<p>No current vacancy income gaps.</p>}
        <button className="secondary wide" onClick={()=>onGo('Buy Box')}><Target size={17}/> Analyze your next deal</button>
      </div>
    </section>
  </>
}

function RentTable({properties,residents:rs,payments,month,onRecord,onDelete}){
  return <div className="table">
    <div className="tr th"><span>Resident</span><span>Suite</span><span>Rent</span><span>Status</span></div>
    {rs.map(r=>{const paid=paidForMonth(payments,r.id,month);const balance=residentBalance(payments,r,month);return <div className="tr clickable" key={r.id} onClick={()=>onRecord?.(r)}>
      <span><strong>{r.name}</strong><small>{r.payerName||payers.find(p=>p.id===r.payerId)?.name||r.email||''}</small></span>
      <span>{properties.find(p=>p.id===r.propertyId)?.shortName||'Unassigned'}</span>
      <span>{money(r.rent)}</span>
      <span style={{display:'flex',gap:8,alignItems:'center'}}>
        <button className={balance===0?'paid':paid>0?'partial':'due'}>{balance===0?<CheckCircle2 size={15}/>:<Clock3 size={15}/>} {balance===0?'Paid':paid>0?`${money(balance)} left`:'Due'}</button>
        {onDelete&&<button className="icon-button" onClick={e=>{e.stopPropagation();onDelete(r.id)}}><X size={15}/></button>}
      </span>
    </div>})}
  </div>
}

function Residents({properties,query,setQuery,residents:rs,payments,month,onRecord,onAdd,onDelete}){
  return <div className="card">
    <div className="card-head">
      <div><h2>Residents</h2><p>Add tenants as leases are signed.</p></div>
      <button className="primary" onClick={onAdd}><Plus size={16}/> Add Resident</button>
    </div>
    <div className="toolbar"><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search residents"/></div></div>
    <RentTable properties={properties} residents={rs} payments={payments} month={month} onRecord={onRecord} onDelete={onDelete}/>
  </div>
}

function Properties({properties,residents,payments,month,onAdd,onOpen}){
  return <>
    <div className="card-head"><div><h2>Your Properties</h2><p>Add properties as your portfolio grows.</p></div><button className="primary" onClick={onAdd}><Plus size={16}/> Add Property</button></div>
    <section className="property-grid">{properties.map(p=>{
      const rs=residents.filter(r=>r.propertyId===p.id);
      const collected=rs.reduce((s,r)=>s+paidForMonth(payments,r.id,month),0);
      const fixedMonthly=Number(p.hoaMonthly||0)+Number(p.internetMonthly||0)+Number(p.insuranceAnnual||0)/12+Number(p.taxesAnnual||0)/12;
      const opportunity=Math.max(0,Number(p.potentialRent||0)-Number(p.currentRent||0));
      const capacity=Number(p.capacity||p.bedrooms||0);
      return <div className="property-card clickable" key={p.id} onClick={()=>onOpen?.(p)}>
        <div className="property-icon"><Building2/></div>
        <span className={`badge ${rs.length>=capacity&&capacity>0?'occupied':'warning'}`}>{rs.length>=capacity&&capacity>0?'Healthy':'Opportunity'}</span>
        <h2>{p.name}</h2>
        <p>{rs.length} of {capacity} rooms occupied · {p.bedrooms}BR/{p.bathrooms}BA · {Number(p.sqft||0).toLocaleString()} sq ft</p>
        <div className="property-metrics four"><div><span>Value</span><strong>{money(p.currentValue)}</strong></div><div><span>Current rent</span><strong>{money(p.currentRent)}</strong></div><div><span>Collected</span><strong>{money(collected)}</strong></div><div><span>Fixed costs</span><strong>{money(fixedMonthly)}/mo</strong></div></div>
        {opportunity>0&&<div className="property-opportunity"><TrendingUp size={17}/><span>Income opportunity</span><strong>+{money(opportunity)}/mo</strong></div>}
      </div>
    })}</section>
  </>
}


function PropertyDetail({property,residents,payments,expenses,maintenance,documents,month,onBack,onRecord,onEdit,onOpenDocument}){
  if(!property) return <div className="card"><button className="secondary" onClick={onBack}>← Back to Properties</button><p>Property not found.</p></div>;
  const rs=residents.filter(r=>r.propertyId===property.id);
  const monthCollected=rs.reduce((s,r)=>s+paidForMonth(payments,r.id,month),0);
  const propertyExpenses=expenses.filter(e=>e.propertyId===property.id);
  const monthExpenses=propertyExpenses.filter(e=>(e.date||'').startsWith(month)).reduce((s,e)=>s+Number(e.amount||0),0);
  const year=month.split('-')[0];
  const ytdExpenses=propertyExpenses.filter(e=>(e.date||'').startsWith(year)).reduce((s,e)=>s+Number(e.amount||0),0);
  const maint=maintenance.filter(m=>m.propertyId===property.id);
  const docs=documents.filter(d=>d.propertyId===property.id);
  const capacity=Number(property.capacity||property.bedrooms||0);
  const fixedMonthly=Number(property.hoaMonthly||0)+Number(property.internetMonthly||0)+Number(property.insuranceAnnual||0)/12+Number(property.taxesAnnual||0)/12;
  const operatingCashFlow=monthCollected-fixedMonthly-monthExpenses;
  const potentialOperatingCashFlow=Number(property.potentialRent||0)-fixedMonthly-monthExpenses;
  const openMaintCount=maint.filter(m=>m.status!=='Completed').length;

  return <>
    <div className="card-head">
      <div>
        <button className="text-button" onClick={onBack}>← Back to Properties</button>
        <h2 style={{marginTop:10}}>{property.name}</h2>
        <p>{property.shortName||''} · {property.bedrooms}BR/{property.bathrooms}BA · {Number(property.sqft||0).toLocaleString()} sq ft</p>
      </div>
      <button className="primary" onClick={()=>onEdit(property)}>Edit Property</button>
    </div>

    <section className="stats" style={{marginBottom:16}}>
      <Stat label="Current value" value={money(property.currentValue)} sub={`Purchase ${money(property.purchasePrice||0)}`}/>
      <Stat label="Monthly rent" value={money(property.currentRent)} sub={`Potential ${money(property.potentialRent)}`}/>
      <Stat label="Collected" value={money(monthCollected)} sub={monthLabel(month)}/>
      <Stat label="Other expenses" value={money(monthExpenses)} sub="Recorded non-fixed expenses"/>
      <Stat label="Actual cash flow" value={money(operatingCashFlow)} sub="Collected less fixed + other expenses"/>
      <Stat label="Potential cash flow" value={money(potentialOperatingCashFlow)} sub="At potential rent with current expenses"/>
      <Stat label="Occupancy" value={`${rs.length}/${capacity}`} sub={capacity?`${Math.round(rs.length/capacity*100)}% occupied`:'No capacity entered'}/>
    </section>

    <section className="grid two">
      <div className="card">
        <div className="card-head"><div><h2>Residents</h2><p>Current residents at this property</p></div></div>
        <RentTable properties={[property]} residents={rs} payments={payments} month={month} onRecord={onRecord}/>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Property Financials</h2><p>Recurring costs and recorded performance</p></div></div>
        <div className="result-grid">
          <Result label="HOA" value={`${money(property.hoaMonthly||0)}/mo`}/>
          <Result label="Internet" value={`${money(property.internetMonthly||0)}/mo`}/>
          <Result label="Insurance" value={`${money(property.insuranceAnnual||0)}/yr`}/>
          <Result label="Property tax" value={`${money(property.taxesAnnual||0)}/yr`}/>
          <Result label="Fixed costs" value={`${money(fixedMonthly)}/mo`}/>
          <Result label={`${year} expenses`} value={money(ytdExpenses)}/>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Maintenance</h2><p>{openMaintCount} open {openMaintCount===1?'item':'items'}</p></div></div>
        {maint.slice(0,5).map(m=><div className="reminder" key={m.id}><div><strong>{m.title}</strong><span>{m.status} · {m.actualCost?money(m.actualCost):m.estimatedCost?`${money(m.estimatedCost)} estimated`:'No cost entered'}</span><small>{m.vendor||m.notes||''}</small></div></div>)}
        {!maint.length&&<Empty title="No maintenance" text="No maintenance items recorded for this property."/>}
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Documents</h2><p>{docs.length} document{docs.length===1?'':'s'} tied to this property</p></div></div>
        {docs.slice(0,6).map(d=><button className="reminder" style={{width:'100%',textAlign:'left',border:0,background:'transparent',cursor:d.storagePath?'pointer':'default'}} key={d.id} onClick={()=>d.storagePath&&onOpenDocument(d)}><div><strong>{d.name}</strong><span>{d.category} · {d.documentDate||d.uploadedAt}</span><small>{d.fileName||''}{d.storagePath?' · Click to open':''}</small></div></button>)}
        {!docs.length&&<Empty title="No documents" text="No documents are tied to this property yet."/>}
      </div>
    </section>
  </>
}

function Payments({residents,properties,payments,month,onRecord,onDelete}){
  const sorted=[...payments].filter(p=>p.month===month).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return <div className="card"><div className="card-head"><div><h2>Payment ledger</h2><p>{monthLabel(month)} payments and methods</p></div><button className="secondary" onClick={onRecord}><Plus size={16}/> Add payment</button></div>
    <div className="ledger"><div className="ledger-row ledger-head"><span>Date</span><span>Resident</span><span>Method</span><span>Amount</span><span></span></div>
      {sorted.map(p=><div className="ledger-row" key={p.id}><span>{p.date}</span><span>{residents.find(r=>r.id===p.residentId)?.name||'Former resident'}</span><span>{p.method}</span><strong>{money(p.amount)}</strong><button className="icon-button" onClick={()=>onDelete(p.id)}><X size={15}/></button></div>)}
      {!sorted.length&&<p>No payments recorded for {monthLabel(month)}.</p>}
    </div>
  </div>
}



function Documents({documents,properties,residents,onAdd,onDelete,onOpen}){
  const [filter,setFilter]=useState('All');
  const shown=documents.filter(d=>filter==='All'||d.category===filter);
  const categories=['All','Lease','Receipt','Proposal / Estimate','Invoice','Inspection','Insurance','HOA','Photo','Other'];
  return <>
    <section className="stats" style={{marginBottom:16}}>
      <Stat label="Documents" value={documents.length} sub="Saved document records"/>
      <Stat label="Leases" value={documents.filter(d=>d.category==='Lease').length} sub="Lease agreements"/>
      <Stat label="Receipts & invoices" value={documents.filter(d=>['Receipt','Invoice'].includes(d.category)).length} sub="Expense backup"/>
      <Stat label="Proposals" value={documents.filter(d=>d.category==='Proposal / Estimate').length} sub="Quotes and estimates"/>
    </section>
    <div className="card">
      <div className="card-head"><div><h2>Document Vault</h2><p>Leases, receipts, proposals, invoices, inspections and property records.</p></div><button className="primary" onClick={onAdd}><Upload size={16}/> Add Document</button></div>
      <div className="toolbar"><label>Filter <select value={filter} onChange={e=>setFilter(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
      <div className="ledger">
        <div className="ledger-row ledger-head"><span>Document</span><span>Property</span><span>Type</span><span>Date</span><span></span></div>
        {shown.map(d=><div className="ledger-row" key={d.id}>
          <span><strong><FileText size={15}/> {d.name}</strong><small>{d.residentId?residents.find(r=>r.id===d.residentId)?.name||'':''}</small></span>
          <span>{properties.find(p=>p.id===d.propertyId)?.shortName||'General'}</span>
          <span>{d.category}</span><span>{d.documentDate||d.uploadedAt}</span>
          <span style={{display:'flex',gap:8}}>{d.storagePath&&<button className="secondary" onClick={()=>onOpen(d)}>Open</button>}<button className="icon-button" onClick={()=>onDelete(d.id)}><X size={15}/></button></span>
        </div>)}
        {!shown.length&&<Empty title="No documents yet" text="Add a lease, receipt, proposal, invoice or other property record."/>}
      </div>
      <div className="explain" style={{marginTop:16}}><FolderOpen size={18}/><div><strong>Private cloud vault connected</strong><p>New files are uploaded to your private Supabase bucket. Open creates a temporary signed link instead of exposing a public file URL.</p></div></div>
    </div>
  </>
}

function Expenses({expenses,properties,month,onAdd,onDelete}){
  const monthItems=[...expenses].filter(e=>(e.date||'').startsWith(month)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const monthTotal=monthItems.reduce((s,e)=>s+Number(e.amount||0),0);
  const year=month.split('-')[0];
  const ytd=expenses.filter(e=>(e.date||'').startsWith(year)).reduce((s,e)=>s+Number(e.amount||0),0);
  const categories={};
  monthItems.forEach(e=>categories[e.category]=(categories[e.category]||0)+Number(e.amount||0));
  return <>
    <section className="stats" style={{marginBottom:16}}>
      <Stat label="This month" value={money(monthTotal)} sub={monthLabel(month)}/>
      <Stat label={`${year} YTD`} value={money(ytd)} sub="All recorded expenses"/>
      <Stat label="Transactions" value={monthItems.length} sub={`${monthLabel(month)} entries`}/>
      <Stat label="Largest category" value={Object.keys(categories).length?Object.entries(categories).sort((a,b)=>b[1]-a[1])[0][0]:'—'} sub={Object.keys(categories).length?money(Object.entries(categories).sort((a,b)=>b[1]-a[1])[0][1]):'No expenses yet'}/>
    </section>
    <div className="card">
      <div className="card-head"><div><h2>Expense Ledger</h2><p>Every dollar out, tied to a property.</p></div><button className="primary" onClick={onAdd}><Plus size={16}/> Add Expense</button></div>
      <div className="ledger">
        <div className="ledger-row ledger-head"><span>Date</span><span>Property</span><span>Category</span><span>Amount</span><span></span></div>
        {monthItems.map(e=><div className="ledger-row" key={e.id}>
          <span>{e.date}</span>
          <span><strong>{properties.find(p=>p.id===e.propertyId)?.shortName||'Property'}</strong><small>{e.vendor||e.method||''}</small></span>
          <span>{e.category}</span>
          <strong>{money(e.amount)}</strong>
          <button className="icon-button" onClick={()=>onDelete(e.id)}><X size={15}/></button>
        </div>)}
        {!monthItems.length&&<Empty title="No expenses recorded" text={`Add expenses for ${monthLabel(month)} as they occur.`}/>}
      </div>
    </div>
  </>
}

function Reminders({residents,payments,month}){
  const due=residents.filter(r=>residentBalance(payments,r,month)>0);
  return <div className="card"><div className="card-head"><div><h2>Friendly reminder queue</h2><p>Billing contacts with a {monthLabel(month)} balance</p></div></div><div className="reminders">
    {due.map(r=>{const p=payers.find(x=>x.id===r.payerId);const payerName=r.payerName||p?.name||r.name;const email=r.payerEmail||p?.email||r.email||'';const balance=residentBalance(payments,r,month);return <div className="reminder" key={r.id}><div><strong>{payerName}</strong><span>{r.name} · {money(balance)} remaining</span><small>{email}</small></div><button onClick={()=>navigator.clipboard?.writeText(`Hi ${payerName.split(' ')[0]}, this is a friendly reminder that ${money(balance)} for ${r.name}'s ${monthLabel(month)} rent is still outstanding. If you've already sent it, please disregard this message. Thank you!`)}>Copy message</button></div>})}
    {!due.length&&<Empty title="Everyone is paid" text={`There are no ${monthLabel(month)} reminders to send.`}/>}
  </div></div>
}

function Maintenance({maintenance,properties,onAdd,onStatus,onDelete}){
  const open=maintenance.filter(m=>m.status!=='Completed');
  const actualTotal=maintenance.reduce((s,m)=>s+Number(m.actualCost||0),0);
  return <>
    <section className="stats" style={{marginBottom:16}}>
      <Stat label="Open items" value={open.length} sub="Needs attention"/>
      <Stat label="Maintenance spent" value={money(actualTotal)} sub="Recorded actual costs"/>
      <Stat label="Completed" value={maintenance.filter(m=>m.status==='Completed').length} sub="Closed requests"/>
    </section>
    <div className="card">
      <div className="card-head"><div><h2>Maintenance</h2><p>Track the issue, vendor, and cost from report to completion.</p></div><button className="primary" onClick={onAdd}><Plus size={16}/> Add Request</button></div>
      <div className="ledger">
        <div className="ledger-row ledger-head"><span>Property</span><span>Issue</span><span>Status</span><span>Cost</span><span></span></div>
        {maintenance.map(m=><div className="ledger-row" key={m.id}>
          <span>{properties.find(p=>p.id===m.propertyId)?.shortName||'Property'}</span>
          <span><strong>{m.title}</strong><small>{m.vendor?`${m.vendor} · `:''}{m.notes}</small></span>
          <span><select value={m.status} onChange={e=>onStatus(m.id,e.target.value)}><option>Open</option><option>Scheduled</option><option>Waiting</option><option>Completed</option></select></span>
          <span><strong>{m.actualCost?money(m.actualCost):m.estimatedCost?`${money(m.estimatedCost)} est.`:'—'}</strong></span>
          <span><button className="icon-button" onClick={()=>onDelete(m.id)}><X size={15}/></button></span>
        </div>)}
        {!maintenance.length&&<Empty title="No maintenance requests" text="Add the first request when something needs attention."/>}
      </div>
    </div>
  </>
}

function PaymentModal({properties,residents,month,initialResidentId,onClose,onSave}){
  const firstId=initialResidentId||residents[0]?.id||'';
  const [residentId,setResidentId]=useState(firstId);
  const resident=residents.find(r=>r.id===residentId);
  const [amount,setAmount]=useState(resident?.rent||0);
  const [method,setMethod]=useState('Venmo');
  const [date,setDate]=useState(todayISO());
  const changeResident=id=>{setResidentId(id);setAmount(residents.find(r=>r.id===id)?.rent||0)};
  if(!residents.length) return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h2>No residents yet</h2><button className="icon-button" onClick={onClose}><X/></button></div><p>Add a resident before recording a payment.</p></div></div>;
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Record Payment</h2><p>{monthLabel(month)} · quick entry</p></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <label>Resident<select value={residentId} onChange={e=>changeResident(e.target.value)}>{residents.map(r=><option value={r.id} key={r.id}>{r.name} · {properties.find(p=>p.id===r.propertyId)?.shortName||'Unassigned'}</option>)}</select></label>
    <label>Amount<input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label>Payment method<div className="method-grid">{['Venmo','ACH','Check','Cash','Other'].map(m=><button type="button" className={method===m?'method active':'method'} onClick={()=>setMethod(m)} key={m}>{m}</button>)}</div></label>
    <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <button className="primary wide save" onClick={()=>onSave({residentId,amount:Number(amount),method,date,month})}><Save size={17}/> Save Payment</button>
  </div></div>
}

function ResidentModal({properties,onClose,onSave}){
  const [form,setForm]=useState({name:'',propertyId:properties[0]?.id||'',rent:'',email:'',phone:'',payerName:'',payerEmail:'',leaseStart:'',leaseEnd:''});
  const set=(key,value)=>setForm(x=>({...x,[key]:value}));
  const save=()=>{
    if(!form.name.trim()) return alert('Please enter the resident name.');
    if(!form.propertyId) return alert('Please choose a property.');
    onSave({...form,name:form.name.trim(),rent:Number(form.rent)||0});
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Add Resident</h2><p>Tenant and payer information in one place.</p></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <div className="form-grid">
      <label>Resident name<input value={form.name} onChange={e=>set('name',e.target.value)}/></label>
      <label>Property<select value={form.propertyId} onChange={e=>set('propertyId',e.target.value)}>{properties.map(p=><option value={p.id} key={p.id}>{p.shortName||p.name}</option>)}</select></label>
      <label>Monthly rent<input type="number" value={form.rent} onChange={e=>set('rent',e.target.value)}/></label>
      <label>Resident email<input value={form.email} onChange={e=>set('email',e.target.value)}/></label>
      <label>Resident phone<input value={form.phone} onChange={e=>set('phone',e.target.value)}/></label>
      <label>Payer / parent name<input value={form.payerName} onChange={e=>set('payerName',e.target.value)}/></label>
      <label>Payer email<input value={form.payerEmail} onChange={e=>set('payerEmail',e.target.value)}/></label>
      <label>Lease start<input type="date" value={form.leaseStart} onChange={e=>set('leaseStart',e.target.value)}/></label>
      <label>Lease end<input type="date" value={form.leaseEnd} onChange={e=>set('leaseEnd',e.target.value)}/></label>
    </div>
    <button className="primary wide save" onClick={save}><Save size={17}/> Save Resident</button>
  </div></div>
}

function MaintenanceModal({properties,onClose,onSave}){
  const [form,setForm]=useState({propertyId:properties[0]?.id||'',title:'',notes:'',vendor:'',estimatedCost:'',actualCost:'',datePaid:'',paymentMethod:''});
  const set=(key,value)=>setForm(x=>({...x,[key]:value}));
  const save=()=>{
    if(!form.title.trim()) return alert('Please describe the maintenance issue.');
    onSave({...form,title:form.title.trim(),estimatedCost:Number(form.estimatedCost)||0,actualCost:Number(form.actualCost)||0});
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Add Maintenance Request</h2><p>Track the repair and the money attached to it.</p></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <div className="form-grid">
      <label>Property<select value={form.propertyId} onChange={e=>set('propertyId',e.target.value)}>{properties.map(p=><option value={p.id} key={p.id}>{p.shortName||p.name}</option>)}</select></label>
      <label>Issue<input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="HVAC not cooling"/></label>
      <label>Vendor<input value={form.vendor} onChange={e=>set('vendor',e.target.value)} placeholder="ABC Heating & Air"/></label>
      <label>Estimated cost<input type="number" value={form.estimatedCost} onChange={e=>set('estimatedCost',e.target.value)}/></label>
      <label>Actual cost<input type="number" value={form.actualCost} onChange={e=>set('actualCost',e.target.value)}/></label>
      <label>Date paid<input type="date" value={form.datePaid} onChange={e=>set('datePaid',e.target.value)}/></label>
      <label>Payment method<select value={form.paymentMethod} onChange={e=>set('paymentMethod',e.target.value)}><option value="">Choose</option><option>Credit Card</option><option>ACH</option><option>Check</option><option>Cash</option><option>Venmo</option><option>Other</option></select></label>
    </div>
    <label>Notes<textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows="4"/></label>
    <button className="primary wide save" onClick={save}><Save size={17}/> Save Request</button>
  </div></div>
}


function DocumentModal({properties,residents,onClose,onSave}){
  const [form,setForm]=useState({name:'',propertyId:properties[0]?.id||'',residentId:'',category:'Lease',documentDate:todayISO(),notes:'',fileName:'',file:null});
  const [saving,setSaving]=useState(false);
  const set=(key,value)=>setForm(x=>({...x,[key]:value}));
  const propertyResidents=residents.filter(r=>!form.propertyId||r.propertyId===form.propertyId);
  const categories=['Lease','Receipt','Proposal / Estimate','Invoice','Inspection','Insurance','HOA','Photo','Other'];
  const save=async()=>{
    if(!form.file) return alert('Please choose the actual file to upload.');
    setSaving(true);
    try{await onSave({...form,name:form.name.trim()||form.fileName});}
    finally{setSaving(false);}
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Add Document</h2><p>Organize it now; private cloud storage connects next.</p></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <div className="form-grid">
      <label>Document name<input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Unit 140 - 2026 Lease"/></label>
      <label>Type<select value={form.category} onChange={e=>set('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Property<select value={form.propertyId} onChange={e=>{set('propertyId',e.target.value);set('residentId','')}}><option value="">General / Portfolio</option>{properties.map(p=><option value={p.id} key={p.id}>{p.shortName||p.name}</option>)}</select></label>
      <label>Resident (optional)<select value={form.residentId} onChange={e=>set('residentId',e.target.value)}><option value="">None</option>{propertyResidents.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
      <label>Document date<input type="date" value={form.documentDate} onChange={e=>set('documentDate',e.target.value)}/></label>
      <label>Choose file<input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx" onChange={e=>{const f=e.target.files?.[0]||null;set('file',f);set('fileName',f?.name||'')}}/><small>{form.fileName||'Choose the PDF, image, Word file, receipt or proposal.'}</small></label>
    </div>
    <label>Notes<textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows="3"/></label>
    <button className="primary wide save" disabled={saving} onClick={save}><Save size={17}/> {saving?'Uploading…':'Upload & Save Document'}</button>
  </div></div>
}

function ExpenseModal({properties,onClose,onSave}){
  const [form,setForm]=useState({propertyId:properties[0]?.id||'',category:'Repairs & Maintenance',amount:'',date:todayISO(),vendor:'',method:'Credit Card',notes:''});
  const set=(key,value)=>setForm(x=>({...x,[key]:value}));
  const save=()=>{
    if(!form.propertyId) return alert('Please choose a property.');
    if(!(Number(form.amount)>0)) return alert('Please enter an expense amount.');
    onSave({...form,amount:Number(form.amount)});
  };
  const categories=['Repairs & Maintenance','HOA','Insurance','Property Tax','Utilities','Internet','Cleaning','Furniture & Appliances','Capital Improvement','Management','Legal / Accounting','Supplies','Other'];
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head"><div><h2>Add Expense</h2><p>Record every dollar out so Rental Pilot can show true profit.</p></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <div className="form-grid">
      <label>Property<select value={form.propertyId} onChange={e=>set('propertyId',e.target.value)}>{properties.map(p=><option value={p.id} key={p.id}>{p.shortName||p.name}</option>)}</select></label>
      <label>Category<select value={form.category} onChange={e=>set('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Amount<input type="number" step="0.01" value={form.amount} onChange={e=>set('amount',e.target.value)}/></label>
      <label>Date<input type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></label>
      <label>Vendor / payee<input value={form.vendor} onChange={e=>set('vendor',e.target.value)}/></label>
      <label>Payment method<select value={form.method} onChange={e=>set('method',e.target.value)}><option>Credit Card</option><option>ACH</option><option>Check</option><option>Cash</option><option>Venmo</option><option>Other</option></select></label>
    </div>
    <label>Notes<textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows="3"/></label>
    <button className="primary wide save" onClick={save}><Save size={17}/> Save Expense</button>
  </div></div>
}

function PropertyModal({mode='add',initial=null,onClose,onSave}){
  const base={
    name:'',shortName:'',purchasePrice:'',currentValue:'',bedrooms:4,bathrooms:3,sqft:'',
    occupied:0,currentRent:'',potentialRent:'',hoaMonthly:'',insuranceAnnual:'',taxesAnnual:'',internetMonthly:''
  };
  const [form,setForm]=useState(()=>initial?{
    ...base,
    ...initial,
    occupied:initial.occupied??0
  }:base);
  const set=(key,value)=>setForm(x=>({...x,[key]:value}));
  const save=()=>{
    if(!String(form.name||'').trim()) return alert('Please enter the property name or address.');
    onSave({
      ...form,
      name:String(form.name).trim(),
      shortName:String(form.shortName||'').trim()||String(form.name).trim(),
      purchasePrice:Number(form.purchasePrice)||0,currentValue:Number(form.currentValue)||0,
      bedrooms:Number(form.bedrooms)||0,bathrooms:Number(form.bathrooms)||0,sqft:Number(form.sqft)||0,
      occupied:Number(form.occupied)||0,currentRent:Number(form.currentRent)||0,potentialRent:Number(form.potentialRent)||0,
      hoaMonthly:Number(form.hoaMonthly)||0,insuranceAnnual:Number(form.insuranceAnnual)||0,
      taxesAnnual:Number(form.taxesAnnual)||0,internetMonthly:Number(form.internetMonthly)||0
    });
  };
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" style={{maxHeight:'88vh',overflowY:'auto'}} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head" style={{position:'sticky',top:0,zIndex:2,background:'white',paddingBottom:10}}>
        <div><h2>{mode==='edit'?'Edit Property':'Add Property'}</h2><p>{mode==='edit'?'Update the property details and financial assumptions.':'Add the numbers you know now. You can refine them later.'}</p></div>
        <button className="icon-button" onClick={onClose}><X/></button>
      </div>
      <div className="form-grid">
        <label>Property / address<input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="118 Ruth Drive – Unit 140"/></label>
        <label>Short name<input value={form.shortName} onChange={e=>set('shortName',e.target.value)} placeholder="Unit 140"/></label>
        <label>Purchase price<input type="number" value={form.purchasePrice} onChange={e=>set('purchasePrice',e.target.value)}/></label>
        <label>Current value<input type="number" value={form.currentValue} onChange={e=>set('currentValue',e.target.value)}/></label>
        <label>Bedrooms<input type="number" value={form.bedrooms} onChange={e=>set('bedrooms',e.target.value)}/></label>
        <label>Bathrooms<input type="number" step="0.5" value={form.bathrooms} onChange={e=>set('bathrooms',e.target.value)}/></label>
        <label>Square feet<input type="number" value={form.sqft} onChange={e=>set('sqft',e.target.value)}/></label>
        <label>Bedrooms occupied<input type="number" value={form.occupied} onChange={e=>set('occupied',e.target.value)}/></label>
        <label>Current monthly rent<input type="number" value={form.currentRent} onChange={e=>set('currentRent',e.target.value)}/></label>
        <label>Potential monthly rent<input type="number" value={form.potentialRent} onChange={e=>set('potentialRent',e.target.value)}/></label>
        <label>Monthly HOA<input type="number" value={form.hoaMonthly} onChange={e=>set('hoaMonthly',e.target.value)}/></label>
        <label>Annual insurance<input type="number" value={form.insuranceAnnual} onChange={e=>set('insuranceAnnual',e.target.value)}/></label>
        <label>Annual property tax<input type="number" value={form.taxesAnnual} onChange={e=>set('taxesAnnual',e.target.value)}/></label>
        <label>Monthly internet<input type="number" value={form.internetMonthly} onChange={e=>set('internetMonthly',e.target.value)}/></label>
      </div>
      <div style={{position:'sticky',bottom:0,background:'white',paddingTop:14,paddingBottom:4}}>
        <button className="primary wide save" onClick={save}><Save size={17}/> {mode==='edit'?'Save Changes':'Save Property'}</button>
      </div>
    </div>
  </div>
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
