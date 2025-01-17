"use client";
import { notifyAction } from "@/app/actions/notify/notifyAction";
import { ChartDataMember, DashboardEarnings } from "@/utils/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { sendWithdrawalEmail, sendWithdrawalSMS } from "../Withdrawal/Member";

export const getDashboard = async (
  supabaseClient: SupabaseClient,
  params: {
    activePhoneNumber: string;
    activeEmail: string;
    teamMemberId: string;
  }
) => {
  const { data, error } = await supabaseClient.rpc("get_dashboard_data", {
    input_data: params,
  });

  if (error) throw error;

  const { data: ChartData } = data;

  if (!ChartData || !Array.isArray(ChartData)) {
    throw new Error("Invalid ChartData format");
  }

  const currentDate = new Date();

  const tomorrow = new Date(currentDate);
  tomorrow.setDate(currentDate.getDate() + 1);

  const unnotifiedData = ChartData.filter((item: ChartDataMember) => {
    const completionDate = new Date(item.completion_date);

    return (
      !item.is_notified && // Check if not already notified
      completionDate.getFullYear() === tomorrow.getFullYear() &&
      completionDate.getMonth() === tomorrow.getMonth() &&
      completionDate.getDate() === tomorrow.getDate()
    );
  });
  if (unnotifiedData.length > 0) {
    const result = await notifyAction({
      chartData: unnotifiedData,
      memberId: params.teamMemberId,
    });

    if (result) {
      if (params.activePhoneNumber) {
        await sendWithdrawalSMS({
          number: params.activePhoneNumber,
          message:
            "Your Package is Ready to Claim Tomorrow, Do not forget to claim it!",
        });
      }

      if (params.activeEmail) {
        await sendWithdrawalEmail({
          to: params.activeEmail,
          from: "Elevate",
          subject: "Package Ready to Claim",
          accountHolderName: "Olympus",
          accountNumber: "1234567890",
          accountType: "Savings",
          accountBank: "BPI",
          message:
            "Your Package is Ready to Claim Tomorrow, Do not forget to claim it!",
          greetingPhrase: "Hello",
          closingPhrase: "Thank you",
          signature: "Olympus",
          transactionDetails: {
            date: "",
            description: "",
            amount: "",
            balance: undefined,
          },
        });
      }
    }
  }

  return data as {
    data: ChartDataMember[];
    totalCompletedAmount: number;
  };
};

export const getDashboardEarnings = async (
  supabaseClient: SupabaseClient,
  params: {
    teamMemberId: string;
  }
) => {
  const { data, error } = await supabaseClient.rpc("get_dashboard_earnings", {
    input_data: params,
  });
  if (error) throw error;

  return data as DashboardEarnings;
};
