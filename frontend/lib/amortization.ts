export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export function buildAmortization(principal: number, annualRate: number, tenureMonths: number): AmortizationRow[] {
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(annualRate) || annualRate < 0 || !Number.isInteger(tenureMonths) || tenureMonths < 1) return [];
  const monthlyRate = annualRate / 100 / 12;
  const payment = monthlyRate === 0
    ? principal / tenureMonths
    : principal * (monthlyRate * (1 + monthlyRate) ** tenureMonths) / ((1 + monthlyRate) ** tenureMonths - 1);
  let balance = principal;
  return Array.from({ length: tenureMonths }, (_, index) => {
    const interest = balance * monthlyRate;
    const principalPart = index === tenureMonths - 1 ? balance : payment - interest;
    const row = {
      month: index + 1,
      payment: index === tenureMonths - 1 ? principalPart + interest : payment,
      interest,
      principal: principalPart,
      balance: Math.max(0, balance - principalPart),
    };
    balance = row.balance;
    return row;
  });
}
