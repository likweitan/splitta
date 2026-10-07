-- Remove receipt-level paid_by column (UI removed, item-level paid_by remains)
alter table receipts drop column if exists paid_by;
