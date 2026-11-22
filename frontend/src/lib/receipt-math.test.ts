import { describe, expect, it } from "vitest"
import {
  itemTaxRate,
  itemsNetTotal,
  paidAmountPercentage,
  withAllocatedTax,
} from "./receipt-math"

const item = (price: number, quantity = 1, discount = 0) => ({
  quantity,
  price_tax_inclusive: price,
  item_specific_discount: discount,
})

describe("itemsNetTotal", () => {
  it("sums price * quantity minus discounts", () => {
    expect(itemsNetTotal([item(10, 2, 5), item(3)])).toBe(18)
  })

  it("returns 0 for no items", () => {
    expect(itemsNetTotal([])).toBe(0)
  })
})

describe("paidAmountPercentage", () => {
  it("returns 0 when total is zero", () => {
    expect(paidAmountPercentage([item(0)])).toBe(0)
  })

  it("computes the rounded share of paid items", () => {
    const items = [
      { ...item(10), paid_by: "u1" },
      { ...item(20), paid_by_name: "Bob" },
      item(10),
    ]
    expect(paidAmountPercentage(items)).toBe(75)
  })

  it("never counts negative item amounts", () => {
    expect(paidAmountPercentage([item(5, 1, 10), { ...item(10), paid_by: "u" }])).toBe(100)
  })
})

describe("itemTaxRate", () => {
  it("is 0 when prices already include tax or tax is not positive", () => {
    expect(itemTaxRate([item(10)], 1, true)).toBe(0)
    expect(itemTaxRate([item(10)], 0, false)).toBe(0)
  })

  it("is tax divided by net total", () => {
    expect(itemTaxRate([item(50), item(50)], 10, false)).toBeCloseTo(0.1)
  })

  it("is 0 when net total is not positive", () => {
    expect(itemTaxRate([], 5, false)).toBe(0)
  })
})

describe("withAllocatedTax", () => {
  it("returns the same items when rate is 0", () => {
    const items = [item(10)]
    expect(withAllocatedTax(items, 0)).toBe(items)
  })

  it("scales prices and discounts by the rate", () => {
    const [result] = withAllocatedTax([item(10, 1, 2)], 0.1)
    expect(result.price_tax_inclusive).toBeCloseTo(11)
    expect(result.item_specific_discount).toBeCloseTo(2.2)
  })
})
