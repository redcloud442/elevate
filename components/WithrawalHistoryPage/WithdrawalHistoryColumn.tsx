import { Button } from "@/components/ui/button";
import { formatDateToYYYYMMDD } from "@/utils/function";
import { WithdrawalRequestData } from "@/utils/types";
import { DialogClose } from "@radix-ui/react-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Copy } from "lucide-react";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";

const statusColorMap: Record<string, string> = {
  APPROVED: "bg-green-500 dark:bg-green-600 dark:text-white",
  REJECTED: "bg-red-500 dark:bg-red-600 dark:text-white",
  PENDING: "bg-yellow-500 dark:bg-yellow-600 dark:text-white",
};

export const WithdrawalHistoryColumn =
  (): ColumnDef<WithdrawalRequestData>[] => {
    return [
      {
        accessorKey: "alliance_withdrawal_request_id",

        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Reference ID <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => {
          const id = row.getValue("alliance_withdrawal_request_id") as string;
          const maxLength = 15;

          const handleCopy = async () => {
            if (id) {
              await navigator.clipboard.writeText(id);
            }
          };

          return (
            <div className="flex items-center space-x-2">
              <div
                className="truncate"
                title={id.length > maxLength ? id : undefined}
              >
                {id.length > maxLength ? `${id.slice(0, maxLength)}...` : id}
              </div>
              {id && (
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <Copy />
                </Button>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "alliance_withdrawal_request_status",

        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => {
          const status = row.getValue(
            "alliance_withdrawal_request_status"
          ) as string;
          const color = statusColorMap[status.toUpperCase()] || "gray"; // Default to gray if status is undefined
          return <Badge className={`${color} text-white`}>{status}</Badge>;
        },
      },

      {
        accessorKey: "alliance_withdrawal_request_amount",

        header: () => <Button variant="ghost">Amount</Button>,
        cell: ({ row }) => {
          const amount = parseFloat(
            row.getValue("alliance_withdrawal_request_amount")
          );
          const formatted = new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
          }).format(amount);
          return <div className="font-medium text-center">{formatted}</div>;
        },
      },
      {
        accessorKey: "alliance_withdrawal_request_type",

        header: () => <Button variant="ghost">Bank Name</Button>,
        cell: ({ row }) => (
          <div className="text-center">
            {row.getValue("alliance_withdrawal_request_type")}
          </div>
        ),
      },
      {
        accessorKey: "alliance_withdrawal_request_account",

        header: () => (
          <Button variant="ghost">
            Bank Account <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center">
            {row.getValue("alliance_withdrawal_request_account")}
          </div>
        ),
      },
      {
        accessorKey: "alliance_withdrawal_request_date",

        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date Created <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center">
            {formatDateToYYYYMMDD(
              row.getValue("alliance_withdrawal_request_date")
            )}
          </div>
        ),
      },
      {
        accessorKey: "alliance_withdrawal_request_reject_note",

        header: () => <div>Rejection Note</div>,
        cell: ({ row }) => {
          const rejectionNote = row.getValue(
            "alliance_withdrawal_request_reject_note"
          ) as string;

          return rejectionNote ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">View Rejection Note</Button>
              </DialogTrigger>
              <DialogContent type="table">
                <DialogHeader>
                  <DialogTitle>Rejection Note</DialogTitle>
                </DialogHeader>
                <div className="flex justify-center items-center">
                  <Textarea value={rejectionNote} readOnly />
                </div>
                <DialogClose asChild>
                  <Button variant="secondary">Close</Button>
                </DialogClose>
              </DialogContent>
            </Dialog>
          ) : null;
        },
      },
    ];
  };
