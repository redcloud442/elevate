import AllyBountyPage from "@/components/AllyBountyPage/AllyBountyPage";
import { protectionAllUser } from "@/utils/serversideProtection";
import { createClientServerSide } from "@/utils/supabase/server";
import { Metadata } from "next";
import { redirect } from "next/navigation";
export const metadata: Metadata = {
  title: "Legion Bounty",
  description: "Legion Bounty Page",
  openGraph: {
    url: "/direct-loot",
  },
};

const Page = async () => {
  const supabase = await createClientServerSide();
  const { teamMemberProfile } = await protectionAllUser();

  if (!teamMemberProfile) return redirect("/500");

  const { data, error } = await supabase.rpc("get_direct_sponsor", {
    input_data: {
      teamMemberId: teamMemberProfile.alliance_member_id,
    },
  });

  if (error) throw error;
  console.log(teamMemberProfile);
  return (
    <AllyBountyPage
      teamMemberProfile={teamMemberProfile}
      sponsor={data as string}
    />
  );
};

export default Page;
