import UserAdminProfile from "@/components/UserAdminProfile/UserAdminProfile";
import { prisma } from "@/lib/db";
import { protectionAdminUser } from "@/utils/serversideProtection";
import { UserRequestdata } from "@/utils/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "User Profile Records",
  description: "List of User Records",
  openGraph: {
    url: "/admin/users",
  },
};

const Page = async ({ params }: { params: Promise<{ userId: string }> }) => {
  const { userId } = await params;

  const { teamMemberProfile } = await protectionAdminUser();

  if (!teamMemberProfile) return redirect("/500");

  const [userData, allianceData] = await prisma.$transaction([
    prisma.user_table.findFirst({
      where: {
        user_id: userId,
      },
    }),
    prisma.alliance_member_table.findFirst({
      where: {
        alliance_member_user_id: userId,
      },
    }),
  ]);

  const combinedData = {
    ...userData,
    ...allianceData,
  } as UserRequestdata;

  if (!combinedData) return redirect("/500");

  return <UserAdminProfile userProfile={combinedData} />;
};

export default Page;