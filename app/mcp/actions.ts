"use server";
import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/access";
import { disconnect } from "@/lib/mcp/grants";

export async function disconnectApp(clientId: string) {
  const a = await getAccess();
  if (!a) return "Sign in again to manage connected apps.";
  if (typeof clientId !== "string" || !clientId) return "App not found.";
  await disconnect(a.user.id, clientId);
  revalidatePath("/mcp");
  return null;
}
