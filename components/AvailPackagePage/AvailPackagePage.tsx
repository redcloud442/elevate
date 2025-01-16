"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { createPackageConnection } from "@/services/Package/Member";
import { escapeFormData } from "@/utils/function";
import { ChartDataMember } from "@/utils/types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  alliance_earnings_table,
  alliance_member_table,
  package_table,
} from "@prisma/client";
import { Loader2 } from "lucide-react";
import { Dispatch, SetStateAction, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Label } from "../ui/label";
import PackageCard from "../ui/packageCard";
type Props = {
  earnings: alliance_earnings_table | null;
  pkg: package_table | [];
  teamMemberProfile: alliance_member_table;
  setEarnings: Dispatch<SetStateAction<alliance_earnings_table | null>>;
  setOpen: Dispatch<SetStateAction<boolean>>;
  setChartData: Dispatch<SetStateAction<ChartDataMember[]>>;
  setSelectedPackage: Dispatch<SetStateAction<package_table | null>>;
  selectedPackage: package_table | null;
};

const AvailPackagePage = ({
  earnings,
  pkg,
  teamMemberProfile,
  setEarnings,
  setOpen,
  setChartData,
  setSelectedPackage,
  selectedPackage,
}: Props) => {
  const { toast } = useToast();
  const [maxAmount, setMaxAmount] = useState(
    earnings?.alliance_combined_earnings ?? 0
  );

  const formattedMaxAmount = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(maxAmount);

  const formSchema = z.object({
    amount: z
      .string()
      .min(3, "Minimum amount is 200 pesos")
      .refine((val) => !isNaN(Number(val)), {
        message: "Amount must be a number",
      })
      .refine((val) => Number(val) <= maxAmount, {
        message: `Amount cannot exceed ${formattedMaxAmount}`,
      }),
    packageId: z.string(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      packageId: selectedPackage?.package_id || "",
    },
  });

  const amount = watch("amount");
  const computation = amount
    ? (Number(amount) * (selectedPackage?.package_percentage ?? 0)) / 100
    : 0;
  const sumOfTotal = Number(amount) + computation;

  const onSubmit = async (data: FormValues) => {
    try {
      const result = escapeFormData({ ...data, amount: Number(data.amount) });
      const now = new Date();
      const completionDate = new Date(
        now.getTime() +
          (selectedPackage?.packages_days ?? 0) * 24 * 60 * 60 * 1000
      );

      await createPackageConnection({
        packageData: {
          amount: Number(result.amount),
          packageId: selectedPackage?.package_id || "",
        },
        teamMemberId: teamMemberProfile.alliance_member_id,
      });

      toast({
        title: "Package Enrolled",
        description: "You have successfully enrolled in a package",
      });

      reset({ amount: "", packageId: selectedPackage?.package_id || "" });

      if (earnings) {
        let remainingAmount = Number(result.amount);

        const olympusDeduction = Math.min(
          remainingAmount,
          earnings.alliance_olympus_earnings
        );
        remainingAmount -= olympusDeduction;

        const referralDeduction = Math.min(
          remainingAmount,
          earnings.alliance_referral_bounty
        );
        remainingAmount -= referralDeduction;

        setEarnings({
          ...earnings,
          alliance_combined_earnings:
            earnings.alliance_combined_earnings - Number(result.amount),
          alliance_olympus_earnings:
            earnings.alliance_olympus_earnings - olympusDeduction,
          alliance_referral_bounty:
            earnings.alliance_referral_bounty - referralDeduction,
        });
      }

      setMaxAmount((prev) => prev - result.amount);

      setChartData((prev) => [
        {
          package: selectedPackage?.package_name || "",
          completion: 0,
          completion_date: completionDate.toISOString(),
          amount: Number(amount),
          is_ready_to_claim: false,
          package_connection_id: selectedPackage?.package_id || "",
          profit_amount: computation,
          package_color: selectedPackage?.package_color || "",
        },
        ...prev,
      ]);
      setSelectedPackage(null);
      setOpen(false);
    } catch (e) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <PackageCard
        key={selectedPackage?.package_id}
        packageId={selectedPackage?.package_id}
        packageImage={selectedPackage?.package_image || undefined}
        packageName={selectedPackage?.package_name || ""}
        selectedPackage={selectedPackage || null}
        packageColor={selectedPackage?.package_color || undefined}
        onClick={() => {}}
      />
      <div className="grid grid-cols-1 gap-8">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2 p-2">
            {/* amount to avail */}
            <div className="flex items-end gap-2 w-full">
              <div className="w-full">
                <Label className="font-bold block mb-2">
                  Balance: {formattedMaxAmount}
                </Label>
                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="amount"
                      type="text"
                      placeholder="Enter amount"
                      {...field}
                      className="w-full" // Set input width to 100%
                      value={field.value || ""}
                      onChange={(e) => {
                        let value = e.target.value;

                        // Allow deleting the value
                        if (value === "") {
                          field.onChange("");
                          return;
                        }

                        // Allow only numbers and a single decimal point
                        value = value.replace(/[^0-9.]/g, "");

                        // Split the value to check for decimal places
                        const parts = value.split(".");
                        if (parts.length > 2) {
                          value = parts[0] + "." + parts[1]; // Keep only the first decimal
                        }

                        // Limit to 2 decimal places
                        if (parts[1]?.length > 2) {
                          value = `${parts[0]}.${parts[1].substring(0, 2)}`;
                        }

                        // Remove leading zeros unless it's "0."
                        if (value.startsWith("0") && !value.startsWith("0.")) {
                          value = value.replace(/^0+/, "");
                        }

                        if (Math.floor(Number(value)).toString().length > 7) {
                          value = value.substring(0, 7);
                        }

                        field.onChange(value);
                      }}
                    />
                  )}
                />
              </div>
              <Button
                variant="card"
                type="button"
                onClick={() => {
                  setValue("amount", maxAmount.toFixed(2));
                }}
                className="h-8 text-sm text-black"
              >
                Max
              </Button>
            </div>

            {errors.amount && (
              <p className="text-primaryRed text-sm">{errors.amount.message}</p>
            )}
            {/* no. days */}

            <div className="flex flex-col gap-2 w-full justify-center items-center text-center">
              <Label className="font-bold text-center" htmlFor="Gross">
                Total Income after {selectedPackage?.packages_days} days
              </Label>
              <Input
                variant="default"
                id="Gross"
                readOnly
                type="text"
                className="text-center w-72" // Ensures full-width and text alignment
                placeholder="Gross Income"
                value={
                  sumOfTotal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || ""
                }
              />
            </div>

            <div className="flex flex-col gap-2 w-full justify-center items-center text-center pt-6">
              <Button
                disabled={isSubmitting || maxAmount === 0}
                type="submit"
                variant="card"
                className="  text-black w-96 rounded-lg "
              >
                {isSubmitting && <Loader2 className="animate-spin mr-2" />}
                Submit
              </Button>
            </div>
          </div>
        </form>
      </div>

      <Button
        variant="card"
        className="w-full rounded-md text-black"
        onClick={() => setSelectedPackage(null)}
      >
        Back to Packages
      </Button>
    </div>
  );
};

export default AvailPackagePage;
