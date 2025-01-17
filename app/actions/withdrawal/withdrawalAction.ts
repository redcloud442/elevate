"use server";

import prisma from "@/utils/prisma";
import { protectionMemberUser } from "@/utils/serversideProtection";
import { alliance_preferred_withdrawal_table } from "@prisma/client";
import { z } from "zod";

export const handleAddPreferredWithdrawal = async (formData: FormData) => {
  try {
    const accountName = formData.get("accountName")?.toString() || "";
    const accountNumber = formData.get("accountNumber")?.toString() || "";
    const bankName = formData.get("bankName")?.toString() || "";

    const validatedData = z
      .object({
        accountName: z.string().min(2, { message: "Account Name is required" }),
        accountNumber: z
          .string()
          .min(10, { message: "Account Number is required" }),
        bankName: z.string().min(2, { message: "Bank Name is required" }),
      })
      .safeParse({
        accountName,
        accountNumber,
        bankName,
      });

    if (!validatedData.success) {
      console.error("Validation Error:", validatedData.error.errors); // Log the error details
      return {
        error: validatedData.error.errors.map((e) => e.message).join(", "),
      };
    }

    const { teamMemberProfile } = await protectionMemberUser();

    const preferredWithdrawal =
      await prisma.alliance_preferred_withdrawal_table.create({
        data: {
          alliance_preferred_withdrawal_account_name: accountName,
          alliance_preferred_withdrawal_account_number: accountNumber,
          alliance_preferred_withdrawal_bank_name: bankName,
          alliance_preferred_withdrawal_member_id:
            teamMemberProfile?.alliance_member_id ?? "",
        },
        select: {
          alliance_preferred_withdrawal_account_name: true,
          alliance_preferred_withdrawal_account_number: true,
          alliance_preferred_withdrawal_bank_name: true,
          alliance_preferred_withdrawal_member_id: true,
          alliance_preferred_withdrawal_id: true,
        },
      });

    return preferredWithdrawal as alliance_preferred_withdrawal_table;
  } catch (error) {
    console.error("Error in handleAddPreferredWithdrawal:", error);
    throw new Error("Internal valid request");
  }
};