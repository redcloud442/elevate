import { ROLE } from "@/utils/constant";
import { decryptData, loginRateLimit } from "@/utils/function";
import prisma from "@/utils/prisma";
import { user_table } from "@prisma/client";
import { NextResponse } from "next/server";

const sendErrorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const getClientIP = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
  request.headers.get("cf-connecting-ip") ||
  "unknown";

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    if (ip === "unknown")
      return sendErrorResponse(
        "Unable to determine IP address for rate limiting.",
        400
      );

    loginRateLimit(ip);

    const { userName, password, role = "MEMBER" } = await request.json();
    if (!userName || !password)
      return sendErrorResponse("Email and password are required.", 400);

    const user = await prisma.user_table.findFirst({
      where: {
        user_username: {
          equals: userName,
          mode: "insensitive",
        },
      },
      include: {
        alliance_member_table: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email." }, { status: 401 });
    }

    // const banned = await prisma.user_history_log.findFirst({
    //   where: {
    //     user_history_user_id: user.user_id,
    //     user_ip_address: ip,
    //     alliance_member_table: {
    //       alliance_member_alliance_id: user.alliance_member_table[0]
    //         ?.alliance_member_alliance_id,
    //     },
    //   },
    // });

    // if (banned) {
    //   return sendErrorResponse("User is banned.", 403);
    // }

    const teamMemberProfile = user.alliance_member_table[0];

    if (!teamMemberProfile)
      return sendErrorResponse("User profile not found or incomplete.", 403);

    const decryptedPassword = await decryptData(
      user.user_password,
      user.user_iv ?? ""
    );
    if (role === ROLE.MEMBER && decryptedPassword !== password) {
      return sendErrorResponse("Password Incorrect", 401);
    }

    if (role === ROLE.ADMIN) {
      const decryptedInputPassword = await decryptData(
        password,
        user.user_iv ?? ""
      );
      if (decryptedInputPassword !== decryptedPassword) {
        return sendErrorResponse("Password Incorrect", 401);
      }
    }

    if (
      teamMemberProfile.alliance_member_restricted ||
      !teamMemberProfile.alliance_member_alliance_id
    ) {
      return sendErrorResponse("Access restricted or incomplete profile.", 403);
    }

    await prisma.$transaction([
      prisma.user_history_log.create({
        data: {
          user_ip_address: ip,
          user_history_user_id: user.user_id,
        },
      }),
    ]);

    const redirects: Record<string, string> = {
      MEMBER: "/",
      ADMIN: "/admin",
    };

    const redirect = redirects[teamMemberProfile.alliance_member_role] || "/";

    return NextResponse.json({ success: true, redirect });
  } catch (error) {
    return sendErrorResponse(
      error instanceof Error ? error.message : "Unknown error.",
      500
    );
  }
}

export async function GET(request: Request) {
  try {
    const ip = getClientIP(request);
    if (ip === "unknown")
      return sendErrorResponse(
        "Unable to determine IP address for rate limiting.",
        400
      );

    const { searchParams } = new URL(request.url);
    const userName = searchParams.get("userName");

    if (!userName) {
      return sendErrorResponse(
        "The 'userName' query parameter is required.",
        400
      );
    }

    const existingUser: user_table | null = await prisma.user_table.findFirst({
      where: {
        user_username: {
          equals: userName,
          mode: "insensitive",
        },
      },
    });

    if (existingUser) {
      return sendErrorResponse("Username already taken.", 409);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return sendErrorResponse(
      error instanceof Error ? error.message : "An unknown error occurred.",
      500
    );
  }
}
