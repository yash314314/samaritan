export function getISTDayRange(date?: Date) {

  const base = date ? new Date(date) : new Date();

  const IST_OFFSET = 5.5 * 60 * 60 * 1000;

  // convert to IST
  const ist = new Date(base.getTime() + IST_OFFSET);

  // start of IST day
  const startIST = new Date(ist);
  startIST.setHours(0,0,0,0);

  // end of IST day
  const endIST = new Date(startIST);
  endIST.setDate(endIST.getDate() + 1);

  // convert back to UTC
  const start = new Date(startIST.getTime() - IST_OFFSET);
  const end = new Date(endIST.getTime() - IST_OFFSET);

  return { start, end };

}