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
    lease_end:r.leaseEnd||null,
    renewal_status:r.renewalStatus||'Undecided',
    marketing_status:r.marketingStatus||'Not Listed'
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
    renewalStatus:r.renewal_status||localExisting?.renewalStatus||'Undecided',
    marketingStatus:r.marketing_status||localExisting?.marketingStatus||'Not Listed',
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

    let cancelled=false;

    const syncPayments=async()=>{
      const {data:rows,error}=await supabase
        .from('payments')
        .select('*')
        .order('paid_on',{ascending:true});
      if(error) throw error;

      // Once signed in, Supabase is the source of truth.
      // An empty cloud table means there are no payments.
      if((rows||[]).length>0){
        const cloudPayments=rows.map(row=>paymentFromDb(row,residents));
        if(!cancelled) savePayments(cloudPayments);
        return;
      }

      // If cloud is empty, clear stale browser payment data.
      if(!cancelled) savePayments([]);
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

    let cancelled=false;

    const syncMaintenance=async()=>{
      const {data:rows,error}=await supabase
        .from('maintenance')
        .select('*')
        .order('created_at',{ascending:true});
      if(error) throw error;

      // Supabase is the source of truth for maintenance.
      if((rows||[]).length>0){
        const cloudMaintenance=rows.map(row=>maintenanceFromDb(row,properties));
        if(!cancelled) saveMaintenance(cloudMaintenance);
        return;
      }

      // Empty cloud table means no maintenance items.
      if(!cancelled) saveMaintenance([]);
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

    let cancelled=false;

    const syncExpenses=async()=>{
      const {data:rows,error}=await supabase
        .from('expenses')
        .select('*')
        .order('incurred_on',{ascending:true});
      if(error) throw error;

      // Once cloud expenses exist, Supabase is the source of truth.
      // Do not merge stale browser-only records back into the app.
      if((rows||[]).length>0){
        const cloudExpenses=rows.map(row=>expenseFromDb(row,properties));
        if(!cancelled) saveExpenses(cloudExpenses);
        return;
      }

      // One-time migration path only when the cloud table is empty.
      const local=loadExpenses();
      if(!local.length){
        if(!cancelled) saveExpenses([]);
        return;
      }

      const propertyIds=[...new Set(local.map(e=>e.propertyId).filter(Boolean))];
      const propertyMapReady=propertyIds.every(id=>properties.find(p=>p.id===id)?.cloudId);
      if(!propertyMapReady) return;

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

  const updateResident = async (id,resident) => {
    const existing=residents.find(r=>r.id===id);
    if(!existing) return;

    const updated={
      ...existing,
      ...resident,
      rent:Number(resident.rent)||0,
      dueDay:Number(resident.dueDay)||1
    };

    saveResidents(residents.map(r=>r.id===id?updated:r));

    if(!session?.user?.id || !existing.cloudId) return;

    try{
      const property=properties.find(p=>p.id===updated.propertyId);
      if(!property?.cloudId) throw new Error('Selected property is not cloud-connected.');

      const payer=payerForResident(updated);
      let billingContactId=existing.cloudBillingContactId||null;

      if(payer.name || payer.email || payer.phone){
        if(billingContactId){
          const {error:contactUpdateError}=await supabase
            .from('billing_contacts')
            .update({
              name:payer.name||updated.name,
              relationship:'Parent / Payer',
              email:payer.email||'',
              phone:payer.phone||''
            })
            .eq('id',billingContactId);
          if(contactUpdateError) throw contactUpdateError;
        }else{
          const {data:contact,error:contactCreateError}=await supabase
            .from('billing_contacts')
            .insert({
              owner_id:session.user.id,
              name:payer.name||updated.name,
              relationship:'Parent / Payer',
              email:payer.email||'',
              phone:payer.phone||''
            })
            .select()
            .single();
          if(contactCreateError) throw contactCreateError;
          billingContactId=contact.id;
        }
      }

      const {error:residentError}=await supabase
        .from('residents')
        .update(residentToDb(updated,session.user.id,property.cloudId,billingContactId))
        .eq('id',existing.cloudId);
      if(residentError) throw residentError;

      saveResidents(residents.map(r=>r.id===id?{
        ...updated,
        cloudBillingContactId:billingContactId,
        payerName:payer.name||'',
        payerEmail:payer.email||'',
        payerPhone:payer.phone||''
      }:r));
    }catch(err){
      console.error('Resident cloud update failed:',err);
      alert(`Resident updated on this device, but cloud update failed: ${err.message||err}`);
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
      <div className="aside-foot">Portfolio workspace<br/><small>Version 2.5 · Vacancy Marketing</small><br/><button className="text-button" style={{marginTop:10}} onClick={()=>supabase.auth.signOut()}>Sign out</button></div>
    </aside>
    <main>
      <header>
        <div><h1>{section}</h1><p>{section==='Command Center'?'What needs your attention today?':'Rental Pilot'}</p></div>
        <button className="primary" onClick={()=>setModal({type:'payment'})}><Plus size={18}/> Record payment</button>
      </header>

      {(section==='Command Center'||section==='Payments'||section==='Expenses'||section==='Reminders') &&
        <MonthPicker month={month} setMonth={setMonth}/>}

      {section==='Command Center' && <CommandCenter properties={properties} residents={residents} payments={payments} expenses={expenses} maintenance={maintenance} month={month} onRecord={r=>setModal({type:'payment',residentId:r?.id})} onGo={setSection} onReviewLease={r=>setModal({type:'resident-edit',resident:r})}/>}
      {section==='Residents' && <Residents properties={properties} query={query} setQuery={setQuery} residents={filtered} payments={payments} month={month} onRecord={r=>setModal({type:'payment',residentId:r.id})} onAdd={()=>setModal({type:'resident'})} onEdit={r=>setModal({type:'resident-edit',resident:r})} onDelete={removeResident}/>}
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
      {section==='Reminders' && <Reminders residents={residents} properties={properties} payments={payments} month={month}/>}
      {section==='Maintenance' && <Maintenance maintenance={maintenance} properties={properties} onAdd={()=>setModal({type:'maintenance'})} onStatus={updateMaintenance} onDelete={removeMaintenance}/>}

    </main>

    {modal?.type==='property' && <PropertyModal mode="add" onClose={()=>setModal(null)} onSave={p=>{addProperty(p);setModal(null);setSection('Properties');}}/>}
    {modal?.type==='property-edit' && <PropertyModal mode="edit" initial={modal.property} onClose={()=>setModal(null)} onSave={p=>{updateProperty(modal.property.id,p);setModal(null);}}/>}
    {modal?.type==='resident' && <ResidentModal mode="add" properties={properties} onClose={()=>setModal(null)} onSave={r=>{addResident(r);setModal(null);setSection('Residents');}}/>}
    {modal?.type==='resident-edit' && <ResidentModal mode="edit" initial={modal.resident} properties={properties} onClose={()=>setModal(null)} onSave={async r=>{await updateResident(modal.resident.id,r);setModal(null);setSection('Residents');}}/>}
    {modal?.type==='payment' && <PaymentModal properties={properties} residents={residents} payments={payments} month={month} initialResidentId={modal.residentId||''} onClose={()=>setModal(null)} onSave={p=>{upsertPayment(p);setModal(null);}}/>}
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
function isVariableIncomeResident(r,properties=[]){
  const property=properties.find(p=>p.id===r?.propertyId);
  const label=`${property?.shortName||''} ${property?.name||''}`.toLowerCase();
  return label.includes('boardwalk');
}
function expectedRentForMonth(r,month,properties=[]){
  if(!r) return 0;
  if(isVariableIncomeResident(r,properties)) return 0;
  const rent=Number(r.rent||0);
  const leaseStart=String(r.leaseStart||'');
  if(leaseStart && leaseStart.slice(0,7)===month){
    const startDay=Number(leaseStart.slice(8,10))||1;
    if(startDay>1){
      // First-month proration uses a simple 30-day rent convention.
      const fraction=Math.min(1,Math.max(0,(31-startDay)/30));
      return Math.round(rent*fraction*100)/100;
    }
  }
  return rent;
}
function residentBalance(payments,r,month,properties=[]){return Math.max(0,expectedRentForMonth(r,month,properties)-paidForMonth(payments,r.id,month))}
function Stat({label,value,sub,tone}){return <div className={`stat ${tone||''}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>}

function CommandCenter({properties,residents,payments,expenses,maintenance,month,onRecord,onGo,onReviewLease}){
  const scheduled=residents.reduce((s,r)=>s+expectedRentForMonth(r,month,properties),0);
  const collected=payments.filter(p=>p.month===month).reduce((s,p)=>s+Number(p.amount),0);
  const outstanding=Math.max(0,scheduled-collected);
  const monthExpenses=expenses.filter(e=>(e.date||'').startsWith(month)).reduce((s,e)=>s+Number(e.amount||0),0);
  const netCollected=collected-monthExpenses;
  const openMaintenance=maintenance.filter(m=>m.status!=='Completed').length;
  const vacancyOpportunity=properties.reduce((s,p)=>s+Math.max(0,Number(p.potentialRent||0)-Number(p.currentRent||0)),0);

  const dueResidents=residents.map(r=>{
    const paid=paidForMonth(payments,r.id,month);
    const balance=Math.max(0,expectedRentForMonth(r,month,properties)-paid);
    const dueDay=Number(r.dueDay)||1;
    const [y,m]=month.split('-').map(Number);
    const dueDate=new Date(y,m-1,dueDay);
    const now=new Date();
    const sameMonth=now.getFullYear()===y && now.getMonth()===(m-1);
    const daysLate=sameMonth && balance>0 && now>dueDate
      ? Math.max(0,Math.floor((now-dueDate)/(1000*60*60*24)))
      : 0;
    return {...r,paid,balance,daysLate};
  }).filter(r=>r.balance>0).sort((a,b)=>b.daysLate-a.daysLate || b.balance-a.balance);

  const partialCount=dueResidents.filter(r=>r.paid>0).length;
  const unpaidCount=dueResidents.filter(r=>r.paid===0).length;
  const paidCount=residents.length-dueResidents.length;

  const today=new Date();
  today.setHours(0,0,0,0);

  const leaseAlerts=residents
    .filter(r=>r.leaseEnd)
    .map(r=>{
      const end=new Date(`${r.leaseEnd}T00:00:00`);
      const days=Math.ceil((end-today)/(1000*60*60*24));
      const property=properties.find(p=>p.id===r.propertyId);
      let level='later';
      if(days<0) level='expired';
      else if(days<=30) level='30';
      else if(days<=60) level='60';
      else if(days<=90) level='90';
      return {...r,days,propertyName:property?.shortName||property?.name||'Unassigned',level,renewalStatus:r.renewalStatus||'Undecided'};
    })
    .filter(r=>r.days<=90)
    .sort((a,b)=>a.days-b.days);

  const urgentLeaseCount=leaseAlerts.filter(r=>r.days<=30).length;
  const notRenewingCount=leaseAlerts.filter(r=>r.renewalStatus==='Not Renewing').length;
  const undecidedCount=leaseAlerts.filter(r=>r.renewalStatus==='Undecided').length;
  const renewingCount=leaseAlerts.filter(r=>r.renewalStatus==='Renewing'||r.renewalStatus==='New Lease Signed').length;

  const marketingQueue=residents
    .filter(r=>r.renewalStatus==='Not Renewing')
    .map(r=>{
      const property=properties.find(p=>p.id===r.propertyId);
      const end=r.leaseEnd?new Date(`${r.leaseEnd}T00:00:00`):null;
      const days=end?Math.ceil((end-today)/(1000*60*60*24)):null;
      return {...r,propertyName:property?.shortName||property?.name||'Unassigned',days,marketingStatus:r.marketingStatus||'Not Listed'};
    })
    .sort((a,b)=>(a.days??9999)-(b.days??9999));

  const opportunities=properties
    .map(p=>({...p,gap:Math.max(0,Number(p.potentialRent||0)-Number(p.currentRent||0))}))
    .filter(p=>p.gap>0)
    .sort((a,b)=>b.gap-a.gap);

  return <>
    <section className="hero-card">
      <div>
        <span className="eyebrow">{monthLabel(month).toUpperCase()}</span>
        <h2>Rent Collection</h2>
        <p>Expected · Collected · Remaining</p>
      </div>
      <div className="hero-numbers">
        <div><span>Expected</span><b>{money(scheduled)}</b></div>
        <div><span>Collected</span><b>{money(collected)}</b></div>
        <div className="remaining"><span>Remaining</span><b>{money(outstanding)}</b></div>
      </div>
    </section>

    <section className="stats">
      <Stat label="Residents paid" value={`${paidCount}/${residents.length}`} sub={`${paidCount} paid in full`}/>
      <Stat label="Residents due" value={dueResidents.length} sub={`${unpaidCount} unpaid · ${partialCount} partial`}/>
      <Stat label="Outstanding rent" value={money(outstanding)} sub={`${monthLabel(month)} balance`} tone={outstanding>0?'opportunity':''}/>
      <Stat label="Lease alerts" value={leaseAlerts.length} sub={urgentLeaseCount?`${urgentLeaseCount} due within 30 days`:'Next 90 days' } tone={leaseAlerts.length?'opportunity':''}/>
      <Stat label="Open maintenance" value={openMaintenance} sub="Items needing attention"/>
      <Stat label="Monthly opportunity" value={money(vacancyOpportunity)} sub="Potential rent not currently leased" tone="opportunity"/>
    </section>

    <section className="grid two">
      <div className="card">
        <div className="card-head">
          <div><h2>Who Owes Me?</h2><p>Residents with an outstanding {monthLabel(month)} balance</p></div>
          <button className="text-button" onClick={()=>onRecord()}>Quick record <ArrowRight size={15}/></button>
        </div>

        <div className="ledger">
          <div className="ledger-row ledger-head" style={{gridTemplateColumns:'minmax(150px,1.45fr) minmax(95px,.9fr) minmax(70px,.7fr) minmax(85px,.8fr) 84px',columnGap:16}}>
            <span>Resident</span><span>Property</span><span>Paid</span><span>Balance</span><span></span>
          </div>
          {dueResidents.map(r=><div className="ledger-row" key={r.id} style={{gridTemplateColumns:'minmax(150px,1.45fr) minmax(95px,.9fr) minmax(70px,.7fr) minmax(85px,.8fr) 84px',columnGap:16}}>
            <span style={{display:'flex',flexDirection:'column',gap:4,minWidth:0,paddingRight:14}}>
              <strong style={{display:'block',lineHeight:1.15}}>{r.name}</strong>
              <small style={{
                display:'inline-block',
                width:'fit-content',
                fontWeight:700,
                lineHeight:1.2,
                color:r.daysLate>0?'#b42318':r.paid>0?'#b54708':'#667085'
              }}>
                {r.daysLate>0?`${r.daysLate} day${r.daysLate===1?'':'s'} late`:r.paid>0?'Partial payment':'Due'}
              </small>
            </span>
            <span style={{paddingLeft:6}}>{properties.find(p=>p.id===r.propertyId)?.shortName||'Unassigned'}</span>
            <span>{money(r.paid)}</span>
            <strong style={{color:r.daysLate>0?'#b42318':'inherit'}}>{money(r.balance)}</strong>
            <button className="secondary" onClick={()=>onRecord(r)}>Record</button>
          </div>)}
          {!dueResidents.length&&<Empty title="Everyone is paid" text={`There are no outstanding balances for ${monthLabel(month)}.`}/>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Lease Expiration Alerts</h2><p>Leases ending in the next 90 days</p></div></div>
        <div className="result-grid" style={{marginBottom:14}}>
          <Result label="Renewing / signed" value={renewingCount}/>
          <Result label="Undecided" value={undecidedCount}/>
          <Result label="Need marketing" value={notRenewingCount}/>
        </div>
        <div className="ledger">
          <div className="ledger-row ledger-head" style={{gridTemplateColumns:'1.05fr .65fr .7fr 1fr 90px',columnGap:12}}>
            <span>Resident</span><span>Property</span><span>Timing</span><span>Decision</span><span></span>
          </div>
          {leaseAlerts.map(r=><div className="ledger-row" key={r.id} style={{gridTemplateColumns:'1.05fr .65fr .7fr 1fr 90px',columnGap:12}}>
            <span style={{display:'flex',flexDirection:'column',gap:3,minWidth:0}}>
              <strong>{r.name}</strong><small>Ends {r.leaseEnd}</small>
            </span>
            <span>{r.propertyName}</span>
            <span><strong style={{color:r.days<=30?'#b42318':r.days<=60?'#b54708':'#667085'}}>{r.days<0?`${Math.abs(r.days)} days expired`:r.days===0?'Ends today':`${r.days} days`}</strong></span>
            <span><strong style={{color:r.renewalStatus==='Not Renewing'?'#b42318':(r.renewalStatus==='Renewing'||r.renewalStatus==='New Lease Signed')?'#067647':'#667085'}}>{r.renewalStatus}</strong></span>
            <button className="secondary" onClick={()=>onReviewLease?.(r)}>Review</button>
          </div>)}
          {!leaseAlerts.length&&<Empty title="No upcoming expirations" text="No resident leases expire in the next 90 days."/>}
        </div>
      </div>
    </section>

    <section className="grid two">
      <div className="card">
        <div className="card-head"><div><h2>Income Opportunities</h2><p>Where more monthly income is available</p></div></div>
        {opportunities.slice(0,3).map(p=><div className="opportunity-card" key={p.id}>
          <div className="opp-icon"><TrendingUp/></div>
          <div>
            <strong>{p.shortName||p.name}</strong>
            <span>Current {money(p.currentRent)} · Potential {money(p.potentialRent)}</span>
            <b>+{money(p.gap)}/month</b>
          </div>
        </div>)}
        {!opportunities.length&&<p>No current vacancy income gaps.</p>}
        <button className="secondary wide" onClick={()=>onGo('Buy Box')}><Target size={17}/> Analyze your next deal</button>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Needs Tenant</h2><p>Residents marked Not Renewing</p></div></div>
        <div className="ledger">
          <div className="ledger-row ledger-head" style={{gridTemplateColumns:'1.1fr .8fr .8fr .9fr'}}>
            <span>Property</span><span>Rent</span><span>Available</span><span>Marketing</span>
          </div>
          {marketingQueue.map(r=><div className="ledger-row" key={r.id} style={{gridTemplateColumns:'1.1fr .8fr .8fr .9fr'}}>
            <span><strong>{r.propertyName}</strong><small>{r.name}</small></span>
            <span>{money(r.rent)}</span>
            <span>{r.days===null?'No date':r.days<0?'Now':r.days===0?'Today':`${r.days} days`}</span>
            <span><strong style={{color:r.marketingStatus==='Lease Signed'?'#067647':r.marketingStatus==='Not Listed'?'#b42318':'#b54708'}}>{r.marketingStatus}</strong></span>
          </div>)}
          {!marketingQueue.length&&<Empty title="Nothing to market" text="No residents are currently marked Not Renewing."/>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Portfolio Snapshot</h2><p>Quick operating view</p></div></div>
        <div className="result-grid">
          <Result label="Net collected" value={money(netCollected)}/>
          <Result label="Open maintenance" value={openMaintenance}/>
          <Result label="Lease alerts" value={leaseAlerts.length}/>
          <Result label="Monthly opportunity" value={money(vacancyOpportunity)}/>
        </div>
      </div>
    </section>
  </>
}


function RentTable({properties,residents:rs,payments,month,onRecord,onDelete}){
  return <div className="table">
    <div className="tr th"><span>Resident</span><span>Suite</span><span>Rent</span><span>Status</span></div>
    {rs.map(r=>{const paid=paidForMonth(payments,r.id,month);const variable=isVariableIncomeResident(r,properties);const balance=residentBalance(payments,r,month,properties);return <div className="tr clickable" key={r.id} onClick={()=>onRecord?.(r)}>
      <span><strong>{r.name}</strong><small>{r.payerName||payers.find(p=>p.id===r.payerId)?.name||r.email||''}</small></span>
      <span>{properties.find(p=>p.id===r.propertyId)?.shortName||'Unassigned'}</span>
      <span>{money(r.rent)}</span>
      <span style={{display:'flex',gap:8,alignItems:'center'}}>
        <button className={variable?'paid':balance===0?'paid':paid>0?'partial':'due'}>{variable?<TrendingUp size={15}/>:balance===0?<CheckCircle2 size={15}/>:<Clock3 size={15}/>} {variable?`${money(paid)} received`:balance===0?'Paid':paid>0?`${money(balance)} left`:'Due'}</button>
        {onDelete&&<button className="icon-button" onClick={e=>{e.stopPropagation();onDelete(r.id)}}><X size={15}/></button>}
      </span>
    </div>})}
  </div>
}

function Residents({properties,query,setQuery,residents:rs,payments,month,onRecord,onAdd,onEdit,onDelete}){
  return <div className="card">
    <div className="card-head">
      <div><h2>Residents</h2><p>Add and manage tenants as leases are signed.</p></div>
      <button className="primary" onClick={onAdd}><Plus size={16}/> Add Resident</button>
    </div>
    <div className="toolbar"><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search residents"/></div></div>
    <div className="table">
      <div className="tr th"><span>Resident</span><span>Suite</span><span>Rent</span><span>Status</span></div>
      {rs.map(r=>{
        const paid=paidForMonth(payments,r.id,month);
        const variable=isVariableIncomeResident(r,properties);
        const balance=residentBalance(payments,r,month,properties);
        return <div className="tr clickable" key={r.id} onClick={()=>onEdit?.(r)}>
          <span><strong>{r.name}</strong><small>{r.payerName||payers.find(p=>p.id===r.payerId)?.name||r.email||''}</small></span>
          <span>{properties.find(p=>p.id===r.propertyId)?.shortName||'Unassigned'}</span>
          <span>{money(r.rent)}</span>
          <span style={{display:'flex',gap:8,alignItems:'center'}}>
            <button className={variable?'paid':balance===0?'paid':paid>0?'partial':'due'} onClick={e=>{e.stopPropagation();onRecord?.(r)}}>{variable?<TrendingUp size={15}/>:balance===0?<CheckCircle2 size={15}/>:<Clock3 size={15}/>} {variable?`${money(paid)} received`:balance===0?'Paid':paid>0?`${money(balance)} left`:'Due'}</button>
            <button className="secondary" onClick={e=>{e.stopPropagation();onEdit?.(r)}}>Edit</button>
            <button className="icon-button" onClick={e=>{e.stopPropagation();onDelete(r.id)}}><X size={15}/></button>
          </span>
        </div>
      })}
    </div>
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
  const propertyResidentIds=new Set(rs.map(r=>r.id));
  const monthCollected=rs.reduce((s,r)=>s+paidForMonth(payments,r.id,month),0);
  const propertyExpenses=expenses.filter(e=>e.propertyId===property.id);

  const recurringExpenseCategory = category => {
    const c=String(category||'').trim().toLowerCase();
    return [
      'hoa','homeowners association',
      'internet','wifi',
      'insurance','property insurance',
      'property tax','property taxes','tax','taxes'
    ].includes(c);
  };

  const variableExpenses=propertyExpenses.filter(e=>!recurringExpenseCategory(e.category));
  const monthVariableExpenses=variableExpenses
    .filter(e=>(e.date||'').startsWith(month))
    .reduce((s,e)=>s+Number(e.amount||0),0);

  const year=month.split('-')[0];
  const selectedMonthNumber=Math.max(1,Number(month.split('-')[1])||1);
  const ytdPayments=payments.filter(p=>propertyResidentIds.has(p.residentId)&&(p.date||'').startsWith(year));
  const ytdCollected=ytdPayments.reduce((s,p)=>s+Number(p.amount||0),0);
  const ytdVariableExpenses=variableExpenses
    .filter(e=>(e.date||'').startsWith(year))
    .reduce((s,e)=>s+Number(e.amount||0),0);

  const maint=maintenance.filter(m=>m.propertyId===property.id);
  const docs=documents.filter(d=>d.propertyId===property.id);
  const capacity=Number(property.capacity||property.bedrooms||0);

  const fixedMonthly=
    Number(property.hoaMonthly||0)+
    Number(property.internetMonthly||0)+
    Number(property.insuranceAnnual||0)/12+
    Number(property.taxesAnnual||0)/12;

  const fixedAnnual=fixedMonthly*12;
  const ytdFixedCosts=fixedMonthly*selectedMonthNumber;

  const currentRent=Number(property.currentRent||0);
  const potentialRent=Number(property.potentialRent||0);
  const vacancyLoss=Math.max(0,potentialRent-currentRent);

  const operatingCashFlow=monthCollected-fixedMonthly-monthVariableExpenses;
  const potentialOperatingCashFlow=potentialRent-fixedMonthly-monthVariableExpenses;
  const ytdNetCashFlow=ytdCollected-ytdFixedCosts-ytdVariableExpenses;

  const annualizedVariableExpenses=(ytdVariableExpenses/selectedMonthNumber)*12;
  const annualGrossAtCurrent=currentRent*12;
  const annualNOI=annualGrossAtCurrent-fixedAnnual-annualizedVariableExpenses;

  const currentValue=Number(property.currentValue||0);
  const purchasePrice=Number(property.purchasePrice||0);
  const capRate=currentValue>0?annualNOI/currentValue*100:0;

  const cashInvested=purchasePrice>0?purchasePrice:currentValue;
  const annualizedCashFlow=(ytdNetCashFlow/selectedMonthNumber)*12;
  const cashOnCash=cashInvested>0?annualizedCashFlow/cashInvested*100:0;

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
      <Stat label="Monthly cash flow" value={money(operatingCashFlow)} sub={`${monthLabel(month)} after recurring + variable expenses`} tone={operatingCashFlow>=0?'':'opportunity'}/>
      <Stat label="YTD rent collected" value={money(ytdCollected)} sub={`${year} payments received`}/>
      <Stat label="YTD variable expenses" value={money(ytdVariableExpenses)} sub="Excludes HOA, internet, insurance and property tax"/>
      <Stat label="YTD net cash flow" value={money(ytdNetCashFlow)} sub={`Through ${monthLabel(month)}`} tone={ytdNetCashFlow>=0?'':'opportunity'}/>
      <Stat label="Vacancy loss" value={money(vacancyLoss)} sub="Potential rent minus current rent" tone={vacancyLoss>0?'opportunity':''}/>
      <Stat label="Cap rate" value={pct(capRate)} sub="Estimated annual NOI ÷ current value"/>
      <Stat label="Cash-on-cash" value={pct(cashOnCash)} sub="Annualized YTD cash flow ÷ purchase basis"/>
      <Stat label="Occupancy" value={`${rs.length}/${capacity}`} sub={capacity?`${Math.round(rs.length/capacity*100)}% occupied`:'No capacity entered'}/>
    </section>

    <section className="grid two">
      <div className="card">
        <div className="card-head"><div><h2>Residents</h2><p>Current residents at this property</p></div></div>
        <RentTable properties={[property]} residents={rs} payments={payments} month={month} onRecord={onRecord}/>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Cash Flow Breakdown</h2><p>Recurring costs separated from variable expenses</p></div></div>
        <div className="result-grid">
          <Result label="Current rent" value={`${money(currentRent)}/mo`}/>
          <Result label="Potential rent" value={`${money(potentialRent)}/mo`}/>
          <Result label="HOA" value={`${money(property.hoaMonthly||0)}/mo`}/>
          <Result label="Internet" value={`${money(property.internetMonthly||0)}/mo`}/>
          <Result label="Insurance" value={`${money(Number(property.insuranceAnnual||0)/12)}/mo`}/>
          <Result label="Property tax" value={`${money(Number(property.taxesAnnual||0)/12)}/mo`}/>
          <Result label="Recurring fixed costs" value={`${money(fixedMonthly)}/mo`}/>
          <Result label="Variable expenses" value={`${money(monthVariableExpenses)}/mo`}/>
          <Result label="YTD recurring costs" value={money(ytdFixedCosts)}/>
          <Result label="YTD variable expenses" value={money(ytdVariableExpenses)}/>
          <Result label="Current cash flow" value={`${money(operatingCashFlow)}/mo`} tone={operatingCashFlow>=0?'good-text':'bad-text'}/>
          <Result label="Potential cash flow" value={`${money(potentialOperatingCashFlow)}/mo`} tone={potentialOperatingCashFlow>=0?'good-text':'bad-text'}/>
          <Result label="YTD net cash flow" value={money(ytdNetCashFlow)} tone={ytdNetCashFlow>=0?'good-text':'bad-text'}/>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div><h2>Investment Performance</h2><p>High-level return indicators</p></div></div>
        <div className="result-grid">
          <Result label="Purchase price" value={money(purchasePrice)}/>
          <Result label="Current value" value={money(currentValue)}/>
          <Result label="Equity gain" value={money(Math.max(0,currentValue-purchasePrice))}/>
          <Result label="Annual gross rent" value={money(annualGrossAtCurrent)}/>
          <Result label="Estimated annual NOI" value={money(annualNOI)} tone={annualNOI>=0?'good-text':'bad-text'}/>
          <Result label="Cap rate" value={pct(capRate)}/>
          <Result label="Annualized cash flow" value={money(annualizedCashFlow)}/>
          <Result label="Cash-on-cash" value={pct(cashOnCash)}/>
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

function Reminders({residents,properties,payments,month}){
  const due=residents.filter(r=>residentBalance(payments,r,month,properties)>0);
  return <div className="card"><div className="card-head"><div><h2>Friendly reminder queue</h2><p>Billing contacts with a {monthLabel(month)} balance</p></div></div><div className="reminders">
    {due.map(r=>{const p=payers.find(x=>x.id===r.payerId);const payerName=r.payerName||p?.name||r.name;const email=r.payerEmail||p?.email||r.email||'';const balance=residentBalance(payments,r,month,properties);return <div className="reminder" key={r.id}><div><strong>{payerName}</strong><span>{r.name} · {money(balance)} remaining</span><small>{email}</small></div><button onClick={()=>navigator.clipboard?.writeText(`Hi ${payerName.split(' ')[0]}, this is a friendly reminder that ${money(balance)} for ${r.name}'s ${monthLabel(month)} rent is still outstanding. If you've already sent it, please disregard this message. Thank you!`)}>Copy message</button></div>})}
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

function PaymentModal({properties,residents,payments,month,initialResidentId,onClose,onSave}){
  const firstId=initialResidentId||residents[0]?.id||'';
  const [residentId,setResidentId]=useState(firstId);
  const resident=residents.find(r=>r.id===residentId);
  const rent=Number(resident?.rent||0);
  const variableIncome=resident ? isVariableIncomeResident(resident,properties) : false;
  const expected=resident ? expectedRentForMonth(resident,month,properties) : 0;
  const alreadyPaid=resident ? paidForMonth(payments||[],resident.id,month) : 0;
  const remaining=Math.max(0,expected-alreadyPaid);
  const [amount,setAmount]=useState(variableIncome?'':remaining);
  const [method,setMethod]=useState('Venmo');
  const [date,setDate]=useState(todayISO());

  useEffect(()=>{
    if(!resident) return;
    const paid=paidForMonth(payments||[],resident.id,month);
    const variable=isVariableIncomeResident(resident,properties);
    const monthExpected=expectedRentForMonth(resident,month,properties);
    setAmount(variable?'':Math.max(0,monthExpected-paid));
  },[residentId,month]);

  const changeResident=id=>setResidentId(id);

  const save=()=>{
    const numericAmount=Number(amount);
    if(!residentId) return alert('Please choose a resident.');
    if(!numericAmount || numericAmount<=0) return alert('Please enter a payment amount greater than $0.');
    if(!variableIncome && numericAmount>remaining && remaining>0){
      if(!window.confirm(`${money(numericAmount)} is more than the ${money(remaining)} remaining balance. Record it anyway?`)) return;
    }
    onSave({residentId,amount:numericAmount,method,date,month});
  };

  if(!residents.length) return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h2>No residents yet</h2><button className="icon-button" onClick={onClose}><X/></button></div><p>Add a resident before recording a payment.</p></div></div>;

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" style={{maxHeight:'88vh',overflowY:'auto',paddingBottom:24}} onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-head" style={{position:'sticky',top:0,zIndex:4,background:'white',paddingBottom:10}}><div><h2>Record Payment</h2><p>{monthLabel(month)} · rent collection</p></div><button className="icon-button" onClick={onClose}><X/></button></div>

    <label>Resident
      <select value={residentId} onChange={e=>changeResident(e.target.value)}>
        {residents.map(r=><option value={r.id} key={r.id}>{r.name} · {properties.find(p=>p.id===r.propertyId)?.shortName||'Unassigned'}</option>)}
      </select>
    </label>

    <div className="result-grid" style={{margin:'12px 0 16px'}}>
      <Result label={variableIncome?'Income type':'Normal monthly rent'} value={variableIncome?'Variable':money(rent)}/>
      <Result label="Expected this month" value={variableIncome?'No fixed amount':money(expected)}/>
      <Result label="Already received" value={money(alreadyPaid)} tone={alreadyPaid>0?'good-text':''}/>
      {!variableIncome && <Result label="Remaining" value={money(remaining)} tone={remaining===0?'good-text':'bad-text'}/>} 
    </div>

    {variableIncome && <div className="empty" style={{padding:14,marginBottom:14}}>
      <strong>Variable income property</strong>
      <p>Enter whatever was actually received this month. There is no fixed amount due.</p>
    </div>}

    {!variableIncome && remaining===0 && <div className="empty" style={{padding:14,marginBottom:14}}>
      <strong>Paid in full for {monthLabel(month)}</strong>
      <p>This resident has no remaining balance for the selected month.</p>
    </div>}

    <label>Payment amount
      <input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/>
    </label>

    <div className="method-grid" style={{marginBottom:16}}>
      {!variableIncome && <button type="button" className="method active" onClick={()=>setAmount(remaining)} disabled={remaining<=0}>Full Balance · {money(remaining)}</button>}
      <button type="button" className="method" onClick={()=>setAmount('')}>Custom Amount</button>
    </div>

    <label>Payment method
      <div className="method-grid">
        {['Venmo','ACH','Check','Cash','Other'].map(m=><button type="button" className={method===m?'method active':'method'} onClick={()=>setMethod(m)} key={m}>{m}</button>)}
      </div>
    </label>

    <label>Date received<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>

    <div style={{position:'sticky',bottom:0,zIndex:4,background:'white',paddingTop:14,paddingBottom:4}}>
      <button className="primary wide save" onClick={save} disabled={!Number(amount)||Number(amount)<=0}>
        <Save size={17}/> Record {Number(amount)>0?money(Number(amount)):'Payment'}
      </button>
    </div>
  </div></div>
}

function ResidentModal({mode='add',initial=null,properties,onClose,onSave}){
  const base={name:'',propertyId:properties[0]?.id||'',rent:'',email:'',phone:'',payerName:'',payerEmail:'',payerPhone:'',leaseStart:'',leaseEnd:'',renewalStatus:'Undecided',marketingStatus:'Not Listed',dueDay:1};
  const [form,setForm]=useState(()=>initial?{
    ...base,
    ...initial,
    payerName:initial.payerName||payers.find(p=>p.id===initial.payerId)?.name||'',
    payerEmail:initial.payerEmail||payers.find(p=>p.id===initial.payerId)?.email||'',
    payerPhone:initial.payerPhone||payers.find(p=>p.id===initial.payerId)?.phone||''
  }:base);
  const [saving,setSaving]=useState(false);
  const set=(key,value)=>setForm(x=>({...x,[key]:value}));

  const save=async()=>{
    if(!String(form.name||'').trim()) return alert('Please enter the resident name.');
    if(!form.propertyId) return alert('Please choose a property.');
    setSaving(true);
    try{
      await onSave({
        ...form,
        name:String(form.name).trim(),
        rent:Number(form.rent)||0,
        dueDay:Number(form.dueDay)||1
      });
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" style={{maxHeight:'88vh',overflowY:'auto',paddingBottom:24}} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head" style={{position:'sticky',top:0,zIndex:4,background:'white',paddingBottom:10}}>
        <div><h2>{mode==='edit'?'Edit Resident':'Add Resident'}</h2><p>{mode==='edit'?'Update tenant, lease and payer information.':'Tenant and payer information in one place.'}</p></div>
        <button className="icon-button" onClick={onClose}><X/></button>
      </div>

      <div className="form-grid">
        <label>Resident name<input value={form.name} onChange={e=>set('name',e.target.value)}/></label>
        <label>Property<select value={form.propertyId} onChange={e=>set('propertyId',e.target.value)}>{properties.map(p=><option value={p.id} key={p.id}>{p.shortName||p.name}</option>)}</select></label>
        <label>Monthly rent<input type="number" value={form.rent} onChange={e=>set('rent',e.target.value)}/></label>
        <label>Rent due day<input type="number" min="1" max="31" value={form.dueDay} onChange={e=>set('dueDay',e.target.value)}/></label>
        <label>Resident email<input value={form.email} onChange={e=>set('email',e.target.value)}/></label>
        <label>Resident phone<input value={form.phone} onChange={e=>set('phone',e.target.value)}/></label>
        <label>Payer / parent name<input value={form.payerName} onChange={e=>set('payerName',e.target.value)}/></label>
        <label>Payer email<input value={form.payerEmail} onChange={e=>set('payerEmail',e.target.value)}/></label>
        <label>Payer phone<input value={form.payerPhone} onChange={e=>set('payerPhone',e.target.value)}/></label>
        <label>Lease start<input type="date" value={form.leaseStart||''} onChange={e=>set('leaseStart',e.target.value)}/></label>
        <label>Lease end<input type="date" value={form.leaseEnd||''} onChange={e=>set('leaseEnd',e.target.value)}/></label>
        <label>Renewal status
          <select value={form.renewalStatus||'Undecided'} onChange={e=>set('renewalStatus',e.target.value)}>
            <option>Undecided</option><option>Renewing</option><option>Not Renewing</option><option>New Lease Signed</option>
          </select>
        </label>
        {form.renewalStatus==='Not Renewing' && <label>Marketing status
          <select value={form.marketingStatus||'Not Listed'} onChange={e=>set('marketingStatus',e.target.value)}>
            <option>Not Listed</option><option>Listed</option><option>Applications</option><option>Lease Signed</option>
          </select>
        </label>}
      </div>

      <div style={{position:'sticky',bottom:0,zIndex:4,background:'white',paddingTop:14,paddingBottom:4}}>
        <button className="primary wide save" disabled={saving} onClick={save}><Save size={17}/> {saving?'Saving…':mode==='edit'?'Save Resident Changes':'Save Resident'}</button>
      </div>
    </div>
  </div>
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
