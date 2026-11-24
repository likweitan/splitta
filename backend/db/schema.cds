namespace splitta;

using { cuid, managed } from '@sap/cds/common';

entity Profiles {
  key ID          : String(255);
      displayName : String(120);
      email       : String(255);
      paymentQrData : LargeString;
}

entity Teams : cuid, managed {
  name    : String(120) not null;
  owner   : String(255) not null;
  members : Association to many TeamMembers on members.team = $self;
}

entity TeamMembers {
  key team   : Association to Teams;
  key userID : String(255);
      role   : String(30);
}

entity PaymentMethods : cuid, managed {
  owner       : String(255) not null;
  bankName    : String(120) not null;
  accountName : String(120);
  paymentType : String(30) not null;
  paymentValue : String(255) not null;
  qrData      : LargeString;
  isDefault   : Boolean default false;
}

entity Webhooks : cuid, managed {
  owner            : String(255) not null;
  name             : String(120);
  url              : String(2000) not null;
  active           : Boolean default true;
  onReceiptCreated : Boolean default true;
  onItemsPaid      : Boolean default true;
  lastTriggeredAt  : Timestamp;
  lastStatus       : String(255);
}

entity Receipts : cuid, managed {
  owner              : String(255) not null;
  team               : Association to Teams;
  merchantName       : String(255) not null;
  currency           : String(3) default 'MYR';
  priceAmount        : Decimal(13,2);
  taxAmount          : Decimal(13,2);
  taxPercentage      : Decimal(7,3);
  discountAmount     : Decimal(13,2);
  roundingAdjustment : Decimal(13,2);
  // false when item prices are pre-tax and taxAmount is added on top of the items
  pricesIncludeTax   : Boolean default true;
  imageData          : LargeBinary;
  paymentMethod      : Association to PaymentMethods;
  items              : Composition of many ReceiptItems on items.receipt = $self;
  viewers            : Association to many ReceiptViewers on viewers.receipt = $self;
}

// Signed-in users who opened a shared receipt link; it appears on their dashboard.
entity ReceiptViewers {
  key receipt : Association to Receipts;
  key userID  : String(255);
}

entity ReceiptItems : cuid, managed {
  receipt               : Association to Receipts not null;
  owner                 : String(255) not null;
  description           : String(255) not null;
  quantity              : Decimal(9,3) default 1;
  priceTaxInclusive     : Decimal(13,2);
  itemSpecificDiscount  : Decimal(13,2);
  paidBy                : String(255);
  paidByName            : String(120);
}
