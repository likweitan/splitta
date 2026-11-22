type SharedReceiptItem {
  ID                   : UUID;
  description          : String(255);
  quantity             : Decimal(9,3);
  priceTaxInclusive    : Decimal(13,2);
  itemSpecificDiscount : Decimal(13,2);
  paidBy               : String(255);
  paidByName            : String(120);
}

type SharedPaymentMethod {
  bankName     : String(120);
  accountName  : String(120);
  paymentType  : String(30);
  paymentValue : String(255);
  qrData       : LargeString;
}

type SharedReceipt {
  ID                 : UUID;
  merchantName       : String(255);
  currency           : String(3);
  priceAmount        : Decimal(13,2);
  taxAmount          : Decimal(13,2);
  taxPercentage      : Decimal(7,3);
  discountAmount     : Decimal(13,2);
  roundingAdjustment : Decimal(13,2);
  pricesIncludeTax   : Boolean;
  imageData          : LargeString; // data URL
  createdAt          : Timestamp;
  items              : many SharedReceiptItem;
  paymentMethod      : SharedPaymentMethod;
}

service PublicReceiptService @(requires: 'any') {
  function getReceipt(ID: UUID) returns SharedReceipt;
  action markAsPaid(ID: UUID, itemIDs: String, paidByName: String, quantities: String) returns Boolean;
}
