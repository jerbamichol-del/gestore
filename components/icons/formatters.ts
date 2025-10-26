
export const formatCurrency = (amount: number): string => {
  const numericAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
  const formattedAmount = new Intl.NumberFormat('it-IT', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
  return `€ ${formattedAmount}`;
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};