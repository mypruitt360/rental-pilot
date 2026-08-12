export const properties = [
  {
    id:'p140', name:'118 Ruth Drive – Unit 140', shortName:'Unit 140', capacity:4, occupied:1,
    purchasePrice:450000, currentValue:500000, potentialRent:3600, currentRent:900,
    hoaMonthly:250, insuranceAnnual:600, taxesAnnual:5000, internetMonthly:100,
    bedrooms:4, bathrooms:3, sqft:2290, status:'Opportunity'
  },
  {
    id:'p310', name:'118 Ruth Drive – Unit 310', shortName:'Unit 310', capacity:4, occupied:4,
    purchasePrice:580000, currentValue:649000, potentialRent:4000, currentRent:4120,
    hoaMonthly:250, insuranceAnnual:700, taxesAnnual:5000, internetMonthly:100,
    bedrooms:4, bathrooms:4, sqft:3003, status:'Healthy'
  },
  {
    id:'p610', name:'118 Ruth Drive – Unit 610', shortName:'Unit 610', capacity:4, occupied:4,
    purchasePrice:490000, currentValue:550000, potentialRent:4000, currentRent:3900,
    hoaMonthly:250, insuranceAnnual:700, taxesAnnual:5000, internetMonthly:100,
    bedrooms:4, bathrooms:3, sqft:2137, status:'Healthy'
  }
];

export const residents = [
  { id:'ella', name:'Ella Franklin', propertyId:'p610', rent:970, dueDay:24, email:'ellafranklin48810@gmail.com', phone:'', payerId:'chris' },
  { id:'ava', name:'Ava Kindt', propertyId:'p610', rent:970, dueDay:24, email:'avalkindt@gmail.com', phone:'(919) 830-7436', payerId:'john' },
  { id:'grace', name:'Grace Traun', propertyId:'p610', rent:990, dueDay:24, email:'lgtruan@icloud.com', phone:'', payerId:'geoff' },
  { id:'mattie', name:'Mattie Traun', propertyId:'p610', rent:970, dueDay:24, email:'amtruan1@icloud.com', phone:'', payerId:'geoff' },
  { id:'gabby', name:'Gabby Finol', propertyId:'p310', rent:927, dueDay:24, email:'gabbyfinol@gmail.com', phone:'', payerId:'gabby-self' },
  { id:'hazen', name:'Hazen Ramey', propertyId:'p310', rent:1030, dueDay:24, email:'hazen.ramey3@gmail.com', phone:'', payerId:'rich' },
  { id:'elyse', name:'Elyse Bergmann', propertyId:'p310', rent:1030, dueDay:24, email:'elyse.bergmann@gmail.com', phone:'(614) 519-3242', payerId:'dwight' },
  { id:'mia', name:'Mia Horwath', propertyId:'p310', rent:1133, dueDay:24, email:'miajordanh@gmail.com', phone:'', payerId:'stephanie' }
];

export const payers = [
  { id:'chris', name:'Chris Franklin', relationship:'Father', email:'driftwoodhomes1@gmail.com', phone:'', residentIds:['ella'] },
  { id:'john', name:'John Kindt', relationship:'Father', email:'johnhkindt@gmail.com', phone:'', residentIds:['ava'] },
  { id:'geoff', name:'Geoff Truan', relationship:'Father', email:'geoff@ecreeksolutions.com', phone:'(470) 865-9578', residentIds:['grace','mattie'] },
  { id:'stephanie', name:'Stephanie Horwath', relationship:'Mother', email:'thehorwaths@mac.com', phone:'', residentIds:['mia'] },
  { id:'dwight', name:'Dwight Bergmann', relationship:'Father', email:'dwight_bergmann@yahoo.com', phone:'', residentIds:['elyse'] },
  { id:'rich', name:'Rich Ramey', relationship:'Father', email:'richramey@mac.com', phone:'', residentIds:['hazen'] },
  { id:'gabby-self', name:'Gabby Finol', relationship:'Self', email:'gabbyfinol@gmail.com', phone:'', residentIds:['gabby'] }
];

export const seedPayments = [
  { id:'pay-elyse-aug', residentId:'elyse', amount:1030, method:'Venmo', month:'2026-08', date:'2026-08' },
  { id:'pay-gabby-aug', residentId:'gabby', amount:924, method:'Venmo', month:'2026-08', date:'2026-08' },
  { id:'pay-mia-aug', residentId:'mia', amount:1133, method:'Venmo', month:'2026-08', date:'2026-08' }
];
