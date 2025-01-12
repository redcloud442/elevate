import { registerUser } from "@/app/actions/auth/authAction";
import { decryptData } from "@/utils/function";
import { UserRequestdata } from "@/utils/types";
import { SupabaseClient } from "@supabase/supabase-js";

export const createTriggerUser = async (
  supabaseClient: SupabaseClient,
  params: {
    userName: string;
    firstName: string;
    lastName: string;
    password: string;
    referalLink?: string;
    url: string;
  }
) => {
  const { userName, password, referalLink, url, firstName, lastName } = params;

  const checkUserNameResult = await checkUserName({ userName });

  if (!checkUserNameResult.success) {
    throw new Error("Username already taken.");
  }

  await registerUser({
    userName,
    password,
    firstName,
    lastName,
    referalLink: referalLink ?? "",
    url,
  });

  return { success: true };
};

export const loginValidation = async (
  supabaseClient: SupabaseClient,
  params: {
    userName: string;
    password: string;
    role?: string;
    iv?: string;
    userProfile?: UserRequestdata;
  }
) => {
  const { userName, password, role, iv } = params;

  const formattedUserName = userName + "@gmail.com";
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("Something went wrong.");
    }

    try {
      const result = await response.json();
      throw new Error(
        result.error || "An error occurred while validating the login."
      );
    } catch (e) {
      throw new Error("An unexpected error occurred.");
    }
  }

  if (role === "ADMIN") {
    const decryptedPassword = await decryptData(password, iv ?? "");

    const { error: signInError } = await supabaseClient.auth.signInWithPassword(
      {
        email: formattedUserName,
        password: decryptedPassword,
      }
    );
    if (signInError) throw signInError;
  } else {
    const { error: signInError } = await supabaseClient.auth.signInWithPassword(
      {
        email: formattedUserName,
        password,
      }
    );
    if (signInError) throw signInError;
  }

  const result = await response.json();

  return result.redirect || "/";
};

export const checkUserName = async (params: { userName: string }) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/?userName=${params.userName}`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    throw new Error("An unexpected error occurred.");
  }

  const result = await response.json();

  return result;
};

export const changeUserPassword = async (params: {
  email: string;
  userId: string;
  password: string;
}) => {
  const { email, password, userId } = params;

  const inputData = {
    email,
    clientpass: password,
  };

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/user/` + userId,
    {
      method: "PUT",
      body: JSON.stringify(inputData),
    }
  );

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      throw new Error("Unexpected HTML response from the server.");
    }

    try {
      await response.json();
    } catch (e) {
      throw new Error("An unexpected error occurred.");
    }
  }

  const result = await response.json();

  if (!result) throw new Error();

  return result;
};
