import { WITHDRAWAL_STATUS } from "@/utils/constant";
import {
  applyRateLimit,
  calculateFee,
  calculateFinalAmount,
  escapeFormData,
} from "@/utils/function";
import prisma from "@/utils/prisma";
import { protectionMemberUser } from "@/utils/serversideProtection";
import { createClientServerSide } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";

    const { teamMemberProfile } = await protectionMemberUser();

    await applyRateLimit(teamMemberProfile?.alliance_member_id || "", ip);

    const supabaseClient = await createClientServerSide();

    const url = new URL(request.url);
    const page = url.searchParams.get("page") || "1";
    const limit = url.searchParams.get("limit") || "10";
    const search = url.searchParams.get("search") || "";
    const columnAccessor = url.searchParams.get("columnAccessor") || "";
    const isAscendingSort = url.searchParams.get("isAscendingSort") || "false";

    if (limit !== "10") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const params = {
      teamMemberId: teamMemberProfile?.alliance_member_id || "",
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      columnAccessor,
      isAscendingSort: isAscendingSort === "true",
      teamId: teamMemberProfile?.alliance_member_alliance_id || "",
    };
    const escapedParams = escapeFormData(params);
    const { data, error } = await supabaseClient.rpc(
      "get_member_withdrawal_history",
      {
        input_data: escapedParams,
      }
    );

    if (error) throw error;
    const { data: withdrawals, totalCount } = data;
    return NextResponse.json({ success: true, data: withdrawals, totalCount });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";

    const { earnings, accountNumber, amount, bank, teamMemberId } =
      await request.json();

    if (!amount || !accountNumber || !bank || !teamMemberId) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    if (!["TOTAL"].includes(earnings)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    if (Number(amount) <= 0 || Number(amount) <= 200) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { teamMemberProfile } = await protectionMemberUser(ip);

    await applyRateLimit(teamMemberId, ip);

    const amountMatch = await prisma.alliance_earnings_table.findUnique({
      where: { alliance_earnings_member_id: teamMemberId },
    });

    if (!amountMatch || !teamMemberProfile?.alliance_member_is_active) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const {
      alliance_olympus_earnings,
      alliance_referral_bounty,
      alliance_combined_earnings,
    } = amountMatch;

    if (Number(amount) > alliance_combined_earnings) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    // Calculate proportional deductions
    let remainingAmount = Number(amount);
    let olympusDeduction = Math.min(remainingAmount, alliance_olympus_earnings);
    remainingAmount -= olympusDeduction;

    let referralDeduction = Math.min(remainingAmount, alliance_referral_bounty);
    remainingAmount -= referralDeduction;

    // If remainingAmount > 0 here, it indicates a miscalculation, but it should not happen
    if (remainingAmount > 0) {
      return NextResponse.json(
        { error: "Insufficient funds to process the request." },
        { status: 400 }
      );
    }

    // Transaction logic
    const [allianceData] = await prisma.$transaction([
      prisma.alliance_withdrawal_request_table.create({
        data: {
          alliance_withdrawal_request_amount: Number(amount),
          alliance_withdrawal_request_type: bank,
          alliance_withdrawal_request_account: accountNumber,
          alliance_withdrawal_request_fee: calculateFee(
            Number(amount),
            earnings
          ),
          alliance_withdrawal_request_withdraw_amount: calculateFinalAmount(
            Number(amount),
            earnings
          ),
          alliance_withdrawal_request_status: WITHDRAWAL_STATUS.PENDING,
          alliance_withdrawal_request_member_id: teamMemberId,
          alliance_withdrawal_request_withdraw_type: earnings,
        },
      }),
      prisma.alliance_earnings_table.update({
        where: { alliance_earnings_member_id: teamMemberId },
        data: {
          alliance_olympus_earnings: { decrement: olympusDeduction },
          alliance_referral_bounty: { decrement: referralDeduction },
          alliance_combined_earnings: { decrement: Number(amount) },
        },
      }),
      prisma.alliance_transaction_table.create({
        data: {
          transaction_amount: Number(amount),
          transaction_description: "Withdrawal Pending",
          transaction_member_id: teamMemberId,
        },
      }),
    ]);

    if (!allianceData) {
      return NextResponse.json(
        {
          error: "Failed to create withdrawal request. Please try again later.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
