import { applyRateLimit } from "@/utils/function";
import prisma from "@/utils/prisma";
import { protectionAdminUser } from "@/utils/serversideProtection";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";

    const { requestId } = await context.params;

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, note }: { status: string; note?: string | null } = body;

    if (!status || !["APPROVED", "PENDING", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid or missing status." },
        { status: 400 }
      );
    }

    const { teamMemberProfile } = await protectionAdminUser();
    if (!teamMemberProfile) {
      return NextResponse.json(
        { error: "User authentication failed." },
        { status: 401 }
      );
    }

    await applyRateLimit(teamMemberProfile?.alliance_member_id, ip);

    const allianceData = await prisma.alliance_top_up_request_table.update({
      where: { alliance_top_up_request_id: requestId },
      data: {
        alliance_top_up_request_status: status,
        alliance_top_up_request_approved_by:
          teamMemberProfile.alliance_member_id,
        alliance_top_up_request_reject_note: note ?? null,
      },
    });

    if (!allianceData) {
      return NextResponse.json(
        { error: "Failed to update top-up request." },
        { status: 500 }
      );
    }

    // Handle additional logic for "APPROVED" status
    if (status === "APPROVED") {
      const updatedEarnings = await prisma.alliance_earnings_table.update({
        where: {
          alliance_earnings_member_id:
            allianceData.alliance_top_up_request_member_id,
        },
        data: {
          alliance_olympus_wallet: allianceData.alliance_top_up_request_amount,
        },
      });

      if (!updatedEarnings) {
        return NextResponse.json(
          { error: "No earnings record found to update." },
          { status: 404 }
        );
      }
    }

    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected error occurred.",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}