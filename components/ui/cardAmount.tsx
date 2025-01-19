import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Info, RefreshCcw } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Skeleton } from "./skeleton";

type Props = {
  title: string;
  value: number;
  description?: ReactNode;
  descriptionClassName?: string;
  children?: React.ReactNode;
  handleClick?: () => void;
  refresh?: boolean;
};

const CardAmount = ({
  title,
  value,
  description,
  descriptionClassName = "text-sm text-gray-500",
  handleClick,
  refresh,
}: Props) => {
  return (
    <Card className="w-full max-w-sm hover:shadow-md bg-opacity-70  hover:shadow-gray-500 dark:hover:shadow-gray-200 transition-all duration-300 p-4">
      <CardHeader className="p-0">
        {/* Title */}
        <CardTitle className="relative text-gray-700 dark:text-gray-300 text-center text-sm font-medium">
          <div className="flex flex-row justify-center items-center gap-1">
            {title}

            <Popover>
              <PopoverTrigger>
                <Info className="w-3 h-3 sm:w-5 sm:h-5 text-white bg-violet-600 rounded-full " />
              </PopoverTrigger>
              <PopoverContent>
                <p>
                  Ito ay ang iyong balance kasama ang wallet, package income at
                  referral income.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </CardTitle>

        {/* Value */}

        {/* Optional Description */}
        {description && (
          <CardDescription
            className={`mt-2 text-center p-0 ${descriptionClassName}`}
          >
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex relative justify-center text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-2 p-0">
        {handleClick && (
          <Button
            variant="ghost"
            className=" px-2 mr-4 bg-white rounded-full"
            onClick={handleClick}
          >
            <RefreshCcw />
          </Button>
        )}
        {refresh ? (
          <Skeleton className="h-9 w-[100px] rounded-full" />
        ) : (
          `₱ ${value}`
        )}
      </CardContent>
    </Card>
  );
};

export default CardAmount;
