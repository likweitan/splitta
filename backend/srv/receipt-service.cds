using { splitta } from '../db/schema';

type ExtractedReceiptItem {
  description          : String(255);
  quantity             : Decimal(9,3);
  priceTaxInclusive     : Decimal(13,2);
  itemSpecificDiscount : Decimal(13,2);
}

type ExtractedReceiptInfo {
  merchantName       : String(255);
  currency           : String(3);
  taxAmount          : Decimal(13,2);
  taxPercentage      : Decimal(7,3);
  discountAmount     : Decimal(13,2);
  priceAmount        : Decimal(13,2);
  roundingAdjustment : Decimal(13,2);
  pricesIncludeTax   : Boolean;
}

type ReceiptExtraction {
  receiptInfo : ExtractedReceiptInfo;
  items       : many ExtractedReceiptItem;
}

annotate ReceiptService with @cds.server.body_parser.limit: '12mb';

service ReceiptService @(requires: 'authenticated-user') {
  entity Receipts @(restrict: [
    { grant: 'READ', to: 'authenticated-user', where: 'owner = $user or exists team.members[userID = $user] or exists viewers[userID = $user]' },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'authenticated-user', where: 'owner = $user' }
  ])
    as projection on splitta.Receipts;

  entity ReceiptItems @(restrict: [
    { grant: 'READ', to: 'authenticated-user', where: 'owner = $user or exists receipt.team.members[userID = $user] or exists receipt.viewers[userID = $user]' },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'authenticated-user', where: 'owner = $user' }
  ])
    as projection on splitta.ReceiptItems;

  entity PaymentMethods @(restrict: [{ grant: '*', to: 'authenticated-user', where: 'owner = $user' }])
    as projection on splitta.PaymentMethods;

  entity Profiles @(restrict: [{ grant: '*', to: 'authenticated-user', where: 'ID = $user' }])
    as projection on splitta.Profiles;

  entity Teams @(restrict: [
    { grant: 'READ', to: 'authenticated-user', where: 'owner = $user or exists members[userID = $user]' },
    { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'authenticated-user', where: 'owner = $user' }
  ])
    as projection on splitta.Teams;

  entity Webhooks @(restrict: [{ grant: '*', to: 'authenticated-user', where: 'owner = $user' }])
    as projection on splitta.Webhooks;

  @readonly
  entity ReceiptViewers @(restrict: [{ grant: 'READ', to: 'authenticated-user', where: 'userID = $user' }])
    as projection on splitta.ReceiptViewers;

  @readonly
  entity TeamMembers @(restrict: [{ grant: 'READ', to: 'authenticated-user', where: 'userID = $user' }])
    as projection on splitta.TeamMembers;

  type CurrentUser {
    ID          : String(255);
    displayName : String(120);
    email       : String(255);
  }

  type WebhookTestResult {
    ok      : Boolean;
    status  : Integer;
    message : String(255);
  }

  action joinReceipt(ID: UUID) returns Boolean;
  function whoAmI() returns CurrentUser;
  action testWebhook(ID: UUID) returns WebhookTestResult;
  function receiptImage(ID: UUID) returns LargeString;
  action extractReceipt(imageData: LargeString, contentType: String(100)) returns ReceiptExtraction;
}

service DirectoryService @(requires: 'authenticated-user') {
  @readonly
  entity Profiles as select from splitta.Profiles {
    key ID,
        displayName
  };
}

annotate ReceiptService.Webhooks with {
  lastTriggeredAt @readonly;
  lastStatus      @readonly;
}

annotate ReceiptService.Receipts with {
  taxAmount     @assert.range: [0, _];
  taxPercentage @assert.range: [0, 100];
}
