export function recurringDueDate(schedule, month) {
  if (!schedule.due_day) return null;
  const [year, m] = month.split('-').map(Number);
  const day = Math.min(schedule.due_day, new Date(year, m, 0).getDate());
  return `${month}-${String(day).padStart(2, '0')}`;
}

export function recurringBills(schedules, expenses, month) {
  return schedules.filter(s => s.active && s.start_on.slice(0, 7) <= month)
    .map(s => {
      const date = recurringDueDate(s, month);
      const payment = expenses.find(e => e.recurringId === s.id && e.recurringMonth === `${month}-01`);
      return { ...s, date, payment, pending: s.amount == null || !date };
    }).filter(s => !s.date || s.date >= s.start_on);
}

export function scheduledCategoryCost(schedules, propertyId, category, month, fallback) {
  const schedule = schedules.find(s => s.propertyId === propertyId && s.category === category);
  if (!schedule) return Number(fallback || 0);
  return recurringBills([schedule], [], month).reduce((total, s) => total + Number(s.amount || 0), 0);
}
