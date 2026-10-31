import Decimal from "decimal.js";

// Configure Decimal for financial precision (ROUND_HALF_UP, 20 precision digits)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal | number | string | { toString(): string };

export function toDecimal(value: MoneyInput | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value.toString());
}

export function round2(value: MoneyInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function addMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return round2(toDecimal(a).plus(toDecimal(b)));
}

export function subMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return round2(toDecimal(a).minus(toDecimal(b)));
}

export function mulMoney(amount: MoneyInput, factor: MoneyInput): Decimal {
  return round2(toDecimal(amount).times(toDecimal(factor)));
}

export function pctOfMoney(amount: MoneyInput, percentage: MoneyInput): Decimal {
  return round2(toDecimal(amount).times(toDecimal(percentage)).dividedBy(100));
}

export function calculateVariantUnitPrice(
  baseSalesPrice: MoneyInput,
  variantAdditionalPrice: MoneyInput = 0
): Decimal {
  return addMoney(baseSalesPrice, variantAdditionalPrice);
}

export function formatINR(value: MoneyInput | null | undefined): string {
  const num = round2(value ?? 0).toNumber();
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function toNumber2(value: MoneyInput | null | undefined): number {
  return round2(value ?? 0).toNumber();
}
