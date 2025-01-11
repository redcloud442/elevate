import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import FileUpload from "@/components/ui/dropZone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logError } from "@/services/Error/ErrorLogs";
import { getMerchantOptions } from "@/services/Options/Options";
import { createTopUpRequest } from "@/services/TopUp/TopUp";
import { escapeFormData } from "@/utils/function";
import { createClientSide } from "@/utils/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { alliance_member_table, merchant_table } from "@prisma/client";
import { CheckCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

type Props = {
  teamMemberProfile: alliance_member_table;
  className: string;
};

const topUpFormSchema = z.object({
  amount: z
    .string()
    .min(3, "Amount is required and must be at least 200 pesos")
    .max(6, "Amount must be less than 6 digits")
    .regex(/^\d+$/, "Amount must be a number")
    .refine((amount) => parseInt(amount, 10) >= 300, {
      message: "Amount must be at least 300 pesos",
    }),
  topUpMode: z.string().min(1, "Top up mode is required"),
  accountName: z.string().min(1, "Field is required"),
  accountNumber: z.string().min(1, "Field is required"),
  file: z
    .instanceof(File)
    .refine((file) => !!file, { message: "File is required" })
    .refine(
      (file) =>
        ["image/jpeg", "image/png", "image/jpg"].includes(file.type) &&
        file.size <= 5 * 1024 * 1024, // 5MB limit
      { message: "File must be a valid image and less than 5MB." }
    ),
});

export type TopUpFormValues = z.infer<typeof topUpFormSchema>;

const DashboardDepositModalDeposit = ({
  teamMemberProfile,
  className,
}: Props) => {
  const supabaseClient = createClientSide();
  const [topUpOptions, setTopUpOptions] = useState<merchant_table[]>([]);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TopUpFormValues>({
    resolver: zodResolver(topUpFormSchema),
    defaultValues: {
      amount: "",
      topUpMode: "",
      accountName: "",
      accountNumber: "",
      file: undefined,
    },
  });

  useEffect(() => {
    const getOptions = async () => {
      try {
        if (!open) return;
        const options = await getMerchantOptions();
        setTopUpOptions(options);
      } catch (e) {
        if (e instanceof Error) {
          await logError(supabaseClient, {
            errorMessage: e.message,
            stackTrace: e.stack,
            stackPath:
              "components/DashboardPage/DashboardDepositRequest/DashboardDepositModal/DashboardDepositModalDeposit.tsx",
          });
        }
      }
    };

    getOptions();
  }, [open]);

  const onSubmit = async (data: TopUpFormValues) => {
    try {
      const sanitizedData = escapeFormData(data);

      await createTopUpRequest({
        TopUpFormValues: sanitizedData,
        teamMemberId: teamMemberProfile.alliance_member_id,
      });

      toast({
        title: "Top Up Successfully",
        description: "Please wait for it to be approved.",
        variant: "success",
      });

      setOpen(false);
      reset();
    } catch (e) {
      if (e instanceof Error) {
        await logError(supabaseClient, {
          errorMessage: e.message,
          stackTrace: e.stack,
          stackPath:
            "components/DashboardPage/DashboardDepositRequest/DashboardDepositModal/DashboardDepositModalDeposit.tsx",
        });
      }

      toast({
        title: "Error",
        description: "Someting went wrong",
        variant: "destructive",
      });
    }
  };

  const onTopUpModeChange = (value: string) => {
    const selectedOption = topUpOptions.find(
      (option) => option.merchant_account_type === value
    );
    if (selectedOption) {
      setValue("accountName", selectedOption.merchant_account_name || "");
      setValue("accountNumber", selectedOption.merchant_account_number || "");
    }
  };
  const uploadedFile = watch("file");

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild className={className}>
        <Button
          className=" h-60 flex flex-col gap-8 items-start sm:justify-center sm:items-center px-4 text-lg"
          onClick={() => setOpen(true)}
        >
          Deposit
          <Image
            src="/assets/deposit.png"
            alt="deposit"
            width={150}
            height={150}
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <ScrollArea className="h-[500px] sm:h-[620px]">
          <DialogHeader className="text-start text-2xl font-bold">
            <DialogTitle>Deposit</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Amount Field */}
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <Input
                    variant="default"
                    type="text"
                    id="amount"
                    className="text-center"
                    placeholder="Enter the top-up amount (e.g., 1000)"
                    {...field}
                    autoFocus
                    value={
                      field.value ? Number(field.value).toLocaleString() : ""
                    }
                    onChange={(e) => {
                      let value = e.target.value;

                      value = value.replace(/\D/g, "");

                      if (value.startsWith("0")) {
                        value = value.replace(/^0+/, "");
                      }
                      if (value.length > 7) {
                        return;
                      }
                      field.onChange(value);
                    }}
                  />
                )}
              />
              {errors.amount && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.amount.message}
                </p>
              )}
            </div>

            {/* Top-Up Mode */}
            <div>
              <Label htmlFor="topUpMode">Cashier Bank</Label>
              <Controller
                name="topUpMode"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      onTopUpModeChange(value);
                    }}
                    value={field.value}
                  >
                    <SelectTrigger className="text-center">
                      <SelectValue placeholder="Select Cashier Bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {topUpOptions.map((option) => (
                        <SelectItem
                          key={option.merchant_id}
                          value={option.merchant_account_type}
                        >
                          {option.merchant_account_type} -{" "}
                          {option.merchant_account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.topUpMode && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.topUpMode.message}
                </p>
              )}
            </div>

            {/* Account Details */}
            <div className="flex flex-col gap-4">
              <div className="flex-1">
                <Label htmlFor="accountName">Account Name</Label>
                <div className="flex gap-2">
                  <Controller
                    name="accountName"
                    control={control}
                    render={({ field }) => (
                      <Input
                        className="text-center"
                        readOnly
                        variant="default"
                        id="accountName"
                        placeholder="Account Name"
                        {...field}
                      />
                    )}
                  />
                  <Button className="w-20 bg-pageColor text-white h-12">
                    Copy
                  </Button>
                </div>
                {errors.accountName && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.accountName.message}
                  </p>
                )}
              </div>
              <div className="flex-1">
                <Label htmlFor="accountNumber">Account Number</Label>
                <div className="flex gap-2">
                  <Controller
                    name="accountNumber"
                    control={control}
                    render={({ field }) => (
                      <Input
                        readOnly
                        className="text-center"
                        id="accountNumber"
                        placeholder="Account Number"
                        {...field}
                      />
                    )}
                  />
                  <Button className="w-20 bg-pageColor text-white h-12">
                    Copy
                  </Button>
                </div>
                {errors.accountNumber && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.accountNumber.message}
                  </p>
                )}
              </div>
            </div>

            {uploadedFile ? (
              <div className="flex flex-col justify-center items-center animate-pulse">
                <CheckCircle
                  className="animate-pulse text-green-600"
                  size={50}
                />
                {errors.file ? (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.file?.message}
                  </p>
                ) : (
                  <p className="text-green-600 text-xl font-bold">
                    File Uploaded
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Controller
                  name="file"
                  control={control}
                  render={({ field }) => (
                    <FileUpload
                      label="Upload Receipt"
                      onFileChange={(file) => field.onChange(file)}
                    />
                  )}
                />
                {errors.file && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.file?.message}
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-center items-center">
              <Button
                type="submit"
                className=" bg-pageColor text-white h-12 "
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}{" "}
                Submit
              </Button>
            </div>
          </form>
          <DialogFooter></DialogFooter>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DashboardDepositModalDeposit;
