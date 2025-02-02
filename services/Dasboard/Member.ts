import { ChartDataMember } from "@/utils/types";

export const getDashboard = async (params: { teamMemberId: string }) => {
  const response = await fetch(`/api/v1/package/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || "An error occurred while fetching the dashboard data."
    );
  }

  const { data } = result;

  return data as ChartDataMember[];
};
