import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
export default async function DemoPage({
  params,
}: {
  params: Promise<{ role: string; path?: string[] }>;
}) {
  const { role, path } = await params;
  if (!["client", "technician", "owner"].includes(role)) notFound();
  return (
    <Workspace
      demo
      role={role as "client" | "technician" | "owner"}
      path={path}
    />
  );
}
