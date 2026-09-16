import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { getSessionUser } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const next =
    "/workspace" +
    (path?.length ? "/" + path.map(encodeURIComponent).join("/") : "");
  const auth = await getSessionUser();
  if (!auth) redirect("/sign-in?next=" + encodeURIComponent(next));
  if (auth.mfaRequired) redirect("/auth/mfa?next=" + encodeURIComponent(next));
  return <Workspace demo={false} path={path} />;
}
