
export const parseLocalYYYYMMDD = (s: string | null | undefined): Date => {
  if (!s) return new Date(); // Fallback safe, anche se logicamente dovrebbe gestire il null chiamante
  const p = s.split('-').map(Number);
  // Mese è 0-indexed in JS Date
  return new Date(p[0], p[1] - 1, p[2]);
};

export const toYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
