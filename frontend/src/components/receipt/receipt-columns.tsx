import { createColumnHelper, type Column } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { receiptTableFeatures } from "./data-table-features";

export interface ReceiptItem {
  id: string;
  description: string;
  quantity: number;
  price_tax_inclusive: number;
  item_specific_discount: number;
  paid_by_name: string | null;
}

export interface Receipt {
  id: string;
  merchant_name: string;
  currency: string;
  price_amount: number;
  created_at: string;
  percent_paid: number;
  items?: ReceiptItem[];
}

type ReceiptColumn<TValue> = Column<
  typeof receiptTableFeatures,
  Receipt,
  TValue
>;

function sortableHeader<TValue>(title: string) {
  return ({ column }: { column: ReceiptColumn<TValue> }) => {
    const sorted = column.getIsSorted();
    const SortIcon =
      sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

    return (
      <Button
        variant="ghost"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(sorted === "asc")}
        aria-label={`Sort by ${title}`}
      >
        {title}
        <SortIcon className="ml-1 h-4 w-4" />
      </Button>
    );
  };
}

const columnHelper = createColumnHelper<typeof receiptTableFeatures, Receipt>();

export function createReceiptColumns(onOpenReceipt: (id: string) => void) {
  return columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(!!value)
          }
          aria-label="Select all receipts on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${row.original.merchant_name} receipt`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    columnHelper.accessor("merchant_name", {
      header: sortableHeader<string>("Merchant"),
      cell: ({ row, getValue }) => (
        <Link
          to={`/receipt/${row.original.id}`}
          onClick={(event) => event.stopPropagation()}
          className="font-medium text-foreground hover:underline"
        >
          {getValue()}
        </Link>
      ),
      filterFn: "includesString",
    }),
    columnHelper.accessor("created_at", {
      header: sortableHeader<string>("Date scanned"),
      cell: ({ getValue }) =>
        new Date(getValue()).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      sortFn: "text",
    }),
    columnHelper.accessor("price_amount", {
      header: sortableHeader<number>("Amount"),
      cell: ({ row, getValue }) => (
        <span className="tabular-nums">
          {row.original.currency} {getValue().toFixed(2)}
        </span>
      ),
      sortFn: "basic",
    }),
    columnHelper.accessor("percent_paid", {
      header: sortableHeader<number>("Status"),
      cell: ({ getValue }) => {
        const percentPaid = getValue();
        return (
          <Badge
            variant="outline"
            className={
              percentPaid === 100
                ? "border-emerald-200 bg-transparent text-xs font-normal text-emerald-600"
                : "border-border bg-transparent text-xs font-normal text-muted-foreground"
            }
          >
            {percentPaid}% paid
          </Badge>
        );
      },
      sortFn: "basic",
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${row.original.merchant_name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => onOpenReceipt(row.original.id)}
            >
              Open receipt
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
      enableHiding: false,
    }),
  ]);
}
