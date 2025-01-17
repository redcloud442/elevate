import { formatMonthDateYear, formatTime } from "@/utils/function";
import { AdminWithdrawaldata } from "@/utils/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { sendWithdrawalEmail } from "./Member";

export const getAdminWithdrawalRequest = async (
  supabaseClient: SupabaseClient,
  params: {
    page: number;
    limit: number;
    search?: string;
    teamMemberId: string;
    teamId: string;
    columnAccessor: string;
    isAscendingSort: boolean;
    userFilter?: string;
    statusFilter?: string;
    dateFilter?: {
      start: string | undefined;
      end: string | undefined;
    };
  }
) => {
  const { data, error } = await supabaseClient.rpc(
    "get_admin_withdrawal_history",
    {
      input_data: params,
    }
  );

  if (error) throw error;

  return data as AdminWithdrawaldata;
};

export const updateWithdrawalStatus = async (params: {
  status: string;
  requestId: string;
  note?: string;
}) => {
  const { requestId } = params;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/withdraw/` + requestId,
    {
      method: "PUT",
      body: JSON.stringify(params),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || "An error occurred while creating the top-up request."
    );
  }
  const { data } = result;

  if (data.alliance_withdrawal_request_email) {
    await sendWithdrawalEmail({
      to: data.alliance_withdrawal_request_email,
      from: "Elevate Team",
      subject: `Withdrawal Request ${data.alliance_withdrawal_request_status.slice(0, 1).toUpperCase() + data.alliance_withdrawal_request_status.slice(1)} !`,
      accountHolderName: data.user_username ?? "",
      accountType: data.alliance_withdrawal_request_account_type ?? "",
      accountBank: data.alliance_withdrawal_request_bank_name ?? "",
      accountNumber: data.alliance_withdrawal_request_account_number ?? "",
      transactionDetails: {
        balance: "",
        date:
          formatMonthDateYear(data.alliance_withdrawal_request_date) +
          ", " +
          formatTime(data.alliance_withdrawal_request_date),
        description: `Withdrawal ${data.alliance_withdrawal_request_status.slice(0, 1).toUpperCase() + data.alliance_withdrawal_request_status.slice(1)} ${data.alliance_withdrawal_request_reject_note ? `(${data.alliance_withdrawal_request_reject_note})` : ""} !`,
        amount:
          "₱" +
          Number(
            data.alliance_withdrawal_request_amount -
              data.alliance_withdrawal_request_fee || 0
          ).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
      message: `Your withdrawal request has been ${data.alliance_withdrawal_request_status.slice(0, 1).toUpperCase() + data.alliance_withdrawal_request_status.slice(1)} !`,
      greetingPhrase: "Hello!",
      closingPhrase: "Thank you for continuous Elevating with us.",
      signature: "The Elevate Team",
    });
  }

  return response;
};
