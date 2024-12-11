import AdminLeaderBoardsPage from "@/components/AdminLeaderBoardsPage/AdminLeaderBoardsPage";
import { protectionAdminUser } from "@/utils/serversideProtection";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Packages",
  description: "List of Packages",
  openGraph: {
    url: "/admin/packages",
  },
};

const Page = async () => {
  const { teamMemberProfile } = await protectionAdminUser();

  if (!teamMemberProfile) return redirect("/500");

  return <AdminLeaderBoardsPage teamMemberProfile={teamMemberProfile} />;
};

export default Page;