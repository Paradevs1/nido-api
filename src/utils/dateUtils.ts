export function calculateDeadline(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export interface DetailedDeadline {
  days: number;
  hours: number;
  minutes: number;
  total_minutes: number;
  is_expired: boolean;
}

export function calculateDetailedDeadline(startDate: Date, endDate: Date): DetailedDeadline {
  const nowUTC = Date.now();
  
  let endDateObj: Date;
  
  if (endDate instanceof Date) {
    const brazilOffsetMs = 3 * 60 * 60 * 1000;
    endDateObj = new Date(endDate.getTime() + brazilOffsetMs);
  } else {
    const dateStr = String(endDate);
    if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      const tempDate = new Date(dateStr + 'Z');
      const brazilOffsetMs = 3 * 60 * 60 * 1000;
      endDateObj = new Date(tempDate.getTime() + brazilOffsetMs);
    } else {
      endDateObj = new Date(dateStr);
    }
  }
  
  const endUTC = endDateObj.getTime();
  
  const diffTime = endUTC - nowUTC;
  if (diffTime <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      total_minutes: 0,
      is_expired: true
    };
  }
  
  const total_minutes = Math.floor(diffTime / (1000 * 60));
  const days = Math.floor(total_minutes / (24 * 60));
  const hours = Math.floor((total_minutes % (24 * 60)) / 60);
  const minutes = total_minutes % 60;
  
  return {
    days,
    hours,
    minutes,
    total_minutes,
    is_expired: false
  };
}

  export function getCurrentDateInBrazil(): Date {
  const now = new Date();
  const brazilOffset = -3 * 60;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brazilTime = new Date(utc + (brazilOffset * 60000));
  return brazilTime;
}