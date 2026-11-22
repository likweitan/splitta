import { useMemo, useState } from "react";
import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type RowSelectionState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Swirling } from "@/components/loading-ui/swirling";
import { createReceiptColumns, type Receipt } from "./receipt-columns";
import { receiptTableFeatures } from "./data-table-features";

interface ReceiptDataTableProps {
  receipts: Receipt[];
  loading: boolean;
  uploadStatus: "uploading" | "saving" | null;
  onOpenReceipt: (id: string) => void;
}

const columnLabels: Record<string, string> = {
  merchant_name: "Merchant",
  created_at: "Date scanned",
  price_amount: "Amount",
  percent_paid: "Status",
};

const responsiveColumnClasses: Record<string, string> = {
  created_at: "hidden sm:table-cell",
  percent_paid: "hidden md:table-cell",
};

export function ReceiptDataTable({
  receipts,
  loading,
  uploadStatus,
  onOpenReceipt,
}: ReceiptDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const columns = useMemo(
    () => createReceiptColumns(onOpenReceipt),
    [onOpenReceipt],
  );

  const table = useTable({
    features: receiptTableFeatures,
    data: receipts,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const merchantColumn = table.getColumn("merchant_name");
  const filterValue = String(merchantColumn?.getFilterValue() ?? "");
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageIndex = table.state.pagination.pageIndex;
  const pageSize = table.state.pagination.pageSize;
  const firstVisibleRow = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastVisibleRow = Math.min((pageIndex + 1) * pageSize, filteredCount);

  return (
    <section aria-label="Receipts table">
      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            placeholder="Search merchants..."
            aria-label="Search receipts by merchant"
            value={filterValue}
            onChange={(event) =>
              merchantColumn?.setFilterValue(event.target.value)
            }
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <SlidersHorizontal className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {columnLabels[column.id] ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={responsiveColumnClasses[header.column.id]}
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {uploadStatus && (
              <TableRow aria-live="polite">
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-4"
                >
                  <div className="flex items-center gap-3">
                    {uploadStatus === "saving" && (
                      <Swirling className="size-7 shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {uploadStatus === "saving"
                          ? "Saving receipt..."
                          : "Uploading receipt..."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This will only take a moment
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-10 text-center text-muted-foreground"
                >
                  Loading receipts...
                </TableCell>
              </TableRow>
            ) : filteredCount === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-10 text-center text-muted-foreground"
                >
                  {receipts.length > 0
                    ? "No receipts match this merchant."
                    : "No receipts to display yet."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={(event) => {
                    if (
                      event.target instanceof Element &&
                      event.target.closest("button, a, [role=checkbox]")
                    ) {
                      return;
                    }
                    onOpenReceipt(row.original.id);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={responsiveColumnClasses[cell.column.id]}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of {filteredCount}{" "}
          receipt(s) selected
        </p>
        <p className="text-sm text-muted-foreground">
          Showing {firstVisibleRow}–{lastVisibleRow} of {filteredCount}
        </p>
        <div className="flex items-center justify-end gap-2">
          <span className="mr-2 text-sm text-muted-foreground">
            Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
