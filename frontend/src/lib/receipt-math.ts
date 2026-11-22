export interface PricedItem {
  quantity: number;
  price_tax_inclusive: number;
  item_specific_discount: number;
}

export interface PaidPricedItem extends PricedItem {
  paid_by?: string | null;
  paid_by_name?: string | null;
}

export function itemsNetTotal(items: PricedItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum +
      item.price_tax_inclusive * item.quantity -
      (item.item_specific_discount || 0),
    0,
  );
}

export function paidAmountPercentage(items: PaidPricedItem[]): number {
  const amount = (item: PricedItem) =>
    Math.max(
      0,
      item.price_tax_inclusive * item.quantity -
        (item.item_specific_discount || 0),
    );
  const totalAmount = items.reduce((total, item) => total + amount(item), 0);
  if (totalAmount <= 0) return 0;

  const paidAmount = items
    .filter((item) => item.paid_by || item.paid_by_name)
    .reduce((total, item) => total + amount(item), 0);
  return Math.round((paidAmount / totalAmount) * 100);
}

/**
 * Rate used to spread receipt-level tax across pre-tax item prices,
 * proportional to each item's share of the item total.
 */
export function itemTaxRate(
  items: PricedItem[],
  taxAmount: number,
  pricesIncludeTax: boolean,
): number {
  if (pricesIncludeTax || !(taxAmount > 0)) return 0;
  const net = itemsNetTotal(items);
  return net > 0 ? taxAmount / net : 0;
}

export function withAllocatedTax<T extends PricedItem>(
  items: T[],
  rate: number,
): T[] {
  if (!rate) return items;
  return items.map((item) => ({
    ...item,
    price_tax_inclusive: item.price_tax_inclusive * (1 + rate),
    item_specific_discount: (item.item_specific_discount || 0) * (1 + rate),
  }));
}
