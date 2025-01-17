import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logError } from "@/services/Error/ErrorLogs";
import {
  createWithdrawalRequest,
  sendWithdrawalEmail,
  sendWithdrawalSMS,
} from "@/services/Withdrawal/Member";
import { useUserNotificationStore } from "@/store/userNotificationStore";
import { useUserTransactionHistoryStore } from "@/store/userTransactionHistoryStore";
import { useUserEarningsStore } from "@/store/useUserEarningsStore";
import { BANKS, E_WALLETS, FINANCIAL_SERVICES } from "@/utils/constant";
import {
  calculateFinalAmount,
  escapeFormData,
  formatMonthDateYear,
} from "@/utils/function";
import { createClientSide } from "@/utils/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  alliance_earnings_table,
  alliance_member_table,
  alliance_notification_table,
  alliance_preferred_withdrawal_table,
  alliance_transaction_table,
  user_table,
} from "@prisma/client";
import { Loader2 } from "lucide-react";
import { Dispatch, SetStateAction } from "react";
import { Controller, useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const withdrawalFormSchema = z.object({
  earnings: z.string(),
  amount: z
    .string()
    .min(2, "Minimum amount is required atleast 30 pesos")
    .refine((amount) => Number(amount) >= 30, {
      message: "Amount must be at least 30 pesos",
    }),
  bank: z.string().min(1, "Please select a bank"),
  email: z.string().email("Invalid email address").optional(),
  cellphoneNumber: z
    .string()
    .min(11, "Please enter your cellphone number")
    .optional(),
  accountName: z
    .string()
    .min(6, "Account name is required")
    .max(40, "Account name must be at most 24 characters"),
  accountNumber: z
    .string()
    .min(6, "Account number is required")
    .max(24, "Account number must be at most 24 digits"),
});

export type WithdrawalFormValues = z.infer<typeof withdrawalFormSchema>;

type Props = {
  teamMemberProfile: alliance_member_table;
  earnings: alliance_earnings_table | null;
  setOpen: Dispatch<SetStateAction<boolean>>;
  preferredEarnings: alliance_preferred_withdrawal_table | null;
  preferredType: string | null;
  profile: user_table;
};

const DashboardWithdrawalModalForm = ({
  teamMemberProfile,
  earnings,
  setOpen,
  preferredEarnings,
  preferredType,
  profile,
}: Props) => {
  const { toast } = useToast();
  const { setEarnings } = useUserEarningsStore();
  const { userNotification, setAddUserNotification } =
    useUserNotificationStore();
  const { setAddTransactionHistory } = useUserTransactionHistoryStore();
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WithdrawalFormValues>({
    mode: "onChange",
    resolver: zodResolver(withdrawalFormSchema),
    defaultValues: {
      earnings: "TOTAL",
      amount: "",
      bank: preferredEarnings?.alliance_preferred_withdrawal_bank_name ?? " ",
      accountName:
        preferredEarnings?.alliance_preferred_withdrawal_account_name ?? "",
      accountNumber:
        preferredEarnings?.alliance_preferred_withdrawal_account_number ?? "",
    },
  });

  const supabase = createClientSide();
  const selectedEarnings = watch("earnings");
  const amount = watch("amount");

  const totalEarnings =
    Number(earnings?.alliance_olympus_earnings ?? 0) +
    Number(earnings?.alliance_referral_bounty ?? 0);

  const getMaxAmount = () => {
    switch (selectedEarnings) {
      case "TOTAL":
        return totalEarnings;
      default:
        return 0;
    }
  };
  // test
  const handleWithdrawalRequest = async (data: WithdrawalFormValues) => {
    try {
      const sanitizedData = escapeFormData(data);

      const validate = withdrawalFormSchema.safeParse(sanitizedData);

      if (!validate.success) {
        throw new Error(validate.error.message);
      }

      const email = sanitizedData.email;
      const cellphoneNumber = sanitizedData.cellphoneNumber;

      const result = await createWithdrawalRequest({
        WithdrawFormValues: sanitizedData,
        teamMemberId: teamMemberProfile.alliance_member_id,
      });

      switch (selectedEarnings) {
        case "TOTAL":
          if (earnings) {
            // Remaining amount to be deducted
            let remainingAmount = Number(sanitizedData.amount);

            // Calculate Olympus Earnings deduction
            const olympusDeduction = Math.min(
              remainingAmount,
              Number(earnings.alliance_olympus_earnings)
            );
            remainingAmount -= olympusDeduction;

            // Calculate Referral Bounty deduction
            const referralDeduction = Math.min(
              remainingAmount,
              Number(earnings.alliance_referral_bounty)
            );
            remainingAmount -= referralDeduction;

            // Ensure no remaining amount (sanity check)
            if (remainingAmount > 0) {
              toast({
                title: "Insufficient funds to update state.",
                description: "Please try again later.",
                variant: "destructive",
              });
              break;
            }

            setEarnings({
              ...earnings,
              alliance_combined_earnings:
                Number(earnings.alliance_combined_earnings) -
                Number(sanitizedData.amount),
              alliance_olympus_earnings:
                Number(earnings.alliance_olympus_earnings) -
                Number(olympusDeduction),
              alliance_referral_bounty:
                Number(earnings.alliance_referral_bounty) -
                Number(referralDeduction),
            });
          }
          break;
        default:
          break;
      }

      const transactionAmount = calculateFinalAmount(
        Number(amount || 0),
        "TOTAL"
      );
      const transactionHistory: alliance_transaction_table = {
        transaction_member_id: teamMemberProfile.alliance_member_id,
        transaction_description: "Withdrawal Ongoing",
        transaction_amount: Math.floor(transactionAmount),
        transaction_date: new Date(),
        transaction_id: uuidv4(),
      };

      const notification: alliance_notification_table = {
        alliance_notification_user_id: teamMemberProfile.alliance_member_id,
        alliance_notification_message:
          "Withdrawal request is Ongoing amounting to ₱ " +
          calculateFinalAmount(Number(amount || 0), "TOTAL").toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }
          ) +
          " Please wait for approval.",
        alliance_notification_date_created: new Date(),
        alliance_notification_is_read: false,
        alliance_notification_id: uuidv4(),
      };

      setAddTransactionHistory([transactionHistory]);

      setAddUserNotification({
        notifications: [notification],
        count: userNotification.count + 1,
      });

      if (email && result) {
        await handleSendEmailRequest(sanitizedData);
      }

      if (cellphoneNumber && result) {
        await handleSendSMSRequest(sanitizedData);
      }

      toast({
        title: "Withdrawal Request Successfully",
        description: "Please wait for it to be approved",
      });

      reset();
      setOpen(false);
    } catch (e) {
      if (e instanceof Error) {
        await logError(supabase, {
          errorMessage: e.message,
          stackTrace: e.stack,
          stackPath:
            "components/DashboardPage/DashboardWithdrawRequest/DashboardWithdrawModal/DashboardWithdrawModalWithdraw.tsx",
        });
      }
      const errorMessage =
        e instanceof Error ? e.message : "An unexpected error occurred.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleSendSMSRequest = async (sanitizedData: WithdrawalFormValues) => {
    try {
      await sendWithdrawalSMS({
        number: sanitizedData.cellphoneNumber ?? "",
        message:
          "Withdrawal request is Ongoing amounting to ₱ " +
          calculateFinalAmount(Number(amount || 0), "TOTAL").toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          ),
      });
    } catch (e) {}
  };

  const handleSendEmailRequest = async (
    sanitizedData: WithdrawalFormValues
  ) => {
    try {
      await sendWithdrawalEmail({
        to: sanitizedData.email ?? "",
        from: "Elevate Team",
        subject: "Withdrawal Request Ongoing.",
        accountHolderName: profile.user_username ?? sanitizedData.accountName,
        accountType:
          preferredEarnings?.alliance_preferred_withdrawal_account_name ??
          sanitizedData.bank,
        accountBank:
          preferredEarnings?.alliance_preferred_withdrawal_bank_name ??
          sanitizedData.bank,
        accountNumber:
          preferredEarnings?.alliance_preferred_withdrawal_account_number ??
          sanitizedData.accountNumber,
        transactionDetails: {
          date: formatMonthDateYear(new Date().toISOString()),
          description: "Withdrawal Request Ongoing.",
          amount:
            "₱" +
            calculateFinalAmount(
              Number(amount || 0),
              selectedEarnings
            ).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          balance:
            "₱" +
            (totalEarnings - Number(amount || 0)).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
        },
        message: "We noticed a new transaction on your account.",
        greetingPhrase: "Hello!",
        closingPhrase: "Thank you for continuously Elevating with us.",
        signature: "The Elevate Team",
      });
    } catch (e) {
      if (e instanceof Error) {
        await logError(supabase, {
          errorMessage: e.message,
          stackTrace: e.stack,
        });
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleWithdrawalRequest)}
      className="space-y-4 mx-auto"
    >
      {/* Earnings Select */}
      <div>
        <Label className="text-green-700" htmlFor="earnings">
          Your Available Balance: ₱
          {totalEarnings.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Label>
      </div>

      {/* Bank Type Select */}
      <div>
        <Label htmlFor="bank">
          {preferredType === "bank"
            ? "Select Bank"
            : preferredType === "ewallet"
              ? "Select E-Wallet"
              : "Select Payment Method"}{" "}
        </Label>
        <Controller
          name="bank"
          control={control}
          render={({ field }) => (
            <Select
              onValueChange={(value) => {
                field.onChange(value);
              }}
              value={field.value}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Bank" />
              </SelectTrigger>
              <SelectContent>
                {preferredType === "bank" &&
                  BANKS.length > 0 &&
                  BANKS.map((bank, index) => (
                    <SelectItem key={index} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                {preferredType === "ewallet" &&
                  E_WALLETS.length > 0 &&
                  E_WALLETS.map((ewallet, index) => (
                    <SelectItem key={index} value={ewallet}>
                      {ewallet}
                    </SelectItem>
                  ))}
                {preferredType === null &&
                  FINANCIAL_SERVICES.length > 0 &&
                  FINANCIAL_SERVICES.map((service, index) => (
                    <SelectItem key={index} value={service}>
                      {service}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        />

        {errors.bank && (
          <p className="text-primaryRed text-sm mt-1">{errors.bank.message}</p>
        )}
      </div>

      {/* Account Name */}
      <div>
        <Label htmlFor="accountName">Account Name</Label>
        <Controller
          name="accountName"
          control={control}
          render={({ field }) => (
            <Input
              type="text"
              id="accountName"
              placeholder="Account Name"
              {...field}
            />
          )}
        />
        {errors.accountName && (
          <p className="text-primaryRed text-sm mt-1">
            {errors.accountName.message}
          </p>
        )}
      </div>

      {/* Account Number */}
      <div>
        <Label htmlFor="accountNumber">Account Number</Label>
        <Controller
          name="accountNumber"
          control={control}
          render={({ field }) => (
            <Input
              type="text"
              id="accountNumber"
              placeholder="Account Number"
              {...field}
            />
          )}
        />
        {errors.accountNumber && (
          <p className="text-primaryRed text-sm mt-1">
            {errors.accountNumber.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="email">Active Email (Optional)</Label>
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Input
              type="text"
              id="email"
              placeholder="Active Email"
              {...field}
            />
          )}
        />
        {errors.accountNumber && (
          <p className="text-primaryRed text-sm mt-1">
            {errors.accountNumber.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="cellphoneNumber">Cellphone Number (Optional)</Label>
        <Controller
          name="cellphoneNumber"
          control={control}
          render={({ field }) => (
            <Input
              type="text"
              id="cellphoneNumber"
              placeholder="Cellphone Number"
              {...field}
            />
          )}
        />
        {errors.cellphoneNumber && (
          <p className="text-primaryRed text-sm mt-1">
            {errors.cellphoneNumber.message}
          </p>
        )}
      </div>

      <div className="flex flex-col w-full space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <div className="flex relative items-center justify-between w-full gap-2">
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <Input
                type="text"
                id="amount"
                className="w-full flex-grow"
                placeholder="Enter amount"
                {...field}
                value={field.value}
                onChange={(e) => {
                  let value = e.target.value;

                  if (value === "") {
                    field.onChange("");
                    return;
                  }

                  // Allow only numbers and a single decimal point
                  value = value.replace(/[^0-9]/g, "");

                  // Prevent multiple decimal points
                  const parts = value.split(".");
                  if (parts.length > 2) {
                    value = parts[0] + "." + parts[1]; // Keep only the first decimal part
                  }

                  // Ensure it doesn't start with multiple zeros (e.g., "00")
                  if (value.startsWith("0") && !value.startsWith("0.")) {
                    value = value.replace(/^0+/, "0");
                  }

                  // Limit decimal places to 2 (adjust as needed)
                  if (value.includes(".")) {
                    const [integerPart, decimalPart] = value.split(".");
                    value = `${integerPart}.${decimalPart.slice(0, 2)}`;
                  }

                  const maxAmount = getMaxAmount();

                  // Enforce the maximum amount value
                  const numericValue = parseFloat(value || "0");
                  if (!isNaN(numericValue) && numericValue > maxAmount) {
                    value = maxAmount.toFixed(0); // Adjust precision to match allowed decimals
                  }

                  field.onChange(value);
                }}
              />
            )}
          />
          <Button
            type="button"
            className="h-6 rounded-md px-2 text-sm bg-sky-200 text-black  border-2 border-black absolute right-2"
            onClick={() => {
              if (!selectedEarnings) {
                toast({
                  title: "Select an earnings",
                  description: "Please select an earnings",
                  variant: "destructive",
                });
                return;
              }
              setValue("amount", getMaxAmount().toFixed(0).toString());
            }}
          >
            MAX
          </Button>
        </div>
        {errors.amount && (
          <p className="text-primaryRed text-sm mt-1">
            {errors.amount.message}
          </p>
        )}
      </div>

      {/* Amount Input */}
      <div className="flex flex-col items-center w-full space-y-2 ">
        <Label htmlFor="amount">Total Net</Label>
        <div className="flex items-center justify-between  w-40 gap-2">
          <Input
            id="amount"
            className="w-full flex-grow text-center"
            readOnly
            value={calculateFinalAmount(
              Number(amount || 0),
              selectedEarnings
            ).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          />
        </div>
        <p className="text-sm text-blue-800 font-semibold">
          10% FEE FOR EVERY WITHDRAWAL REQUEST
        </p>
      </div>

      <div className="bg-white h-28 px-10 p-2">
        <p className="text-md text-center font-semibold">COMPUTATION</p>
        <div className="flex flex-col items-start w-full">
          <p className="text-xs text-start  sm:text-center">5% TAX</p>
          <p className="text-xs text-start  sm:text-center">1% ADMIN FEE</p>
          <p className="text-xs text-start  sm:text-center ">
            2% FOR COMPANY DEVELOPMENT AND INNOVATION
          </p>
          <p className="text-xs text-start  sm:text-center">
            2% CHARITY AND MEDICAL ASSISTANCE
          </p>
        </div>
      </div>

      {/* Submit Button */}

      <Button
        disabled={isSubmitting || getMaxAmount() === 0}
        type="submit"
        variant="card"
        className="w-full rounded-md"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Submitting...
          </>
        ) : (
          "CONFIRM WITHDRAWAL"
        )}
      </Button>
    </form>
  );
};

export default DashboardWithdrawalModalForm;
