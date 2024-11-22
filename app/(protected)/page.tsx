import DashboardPage from "@/components/DashboardPage/DashboardPage";
import { protectionMemberUser } from "@/utils/serversideProtection";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Dascboard",
  description: "List of records",
  openGraph: {
    url: "/",
  },
};

const Page = async () => {
  const result = await protectionMemberUser();

  if (result.redirect) {
    redirect(result.redirect);
  }

  return <DashboardPage />;
};
export default Page;
