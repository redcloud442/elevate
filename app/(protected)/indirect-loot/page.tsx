import LegionBountyPage from "@/components/LegionBountyPage/LegionBountyPage";
import { protectionMemberUser } from "@/utils/serversideProtection";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Legion Bounty",
  description: "Legion Bounty Page",
  openGraph: {
    url: "/indirect-loot",
  },
};

const Page = async () => {
  const { teamMemberProfile } = await protectionMemberUser();
  if (!teamMemberProfile) return redirect("/500");

  if (teamMemberProfile) {
    redirect("/");
  }

  return <LegionBountyPage teamMemberProfile={teamMemberProfile} />;
};

export default Page;
