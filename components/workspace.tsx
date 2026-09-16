"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { DataProvider } from "./provider";
import { AppShell } from "./shell";
import { Dashboard } from "./dashboard";
import { Requests, RequestForm, RequestDetail, Inbox } from "./requests";

import { Loading } from "./ui";
const Calendar = dynamic(() => import("./calendar").then((m) => m.Calendar), {
  loading: () => <Loading />,
});
const Operations = dynamic(
  () => import("./operations").then((m) => m.Operations),
  { loading: () => <Loading /> },
);
export function Workspace({
  demo,
  role,
  path = [],
}: {
  demo: boolean;
  role?: "client" | "technician" | "owner";
  path?: string[];
}) {
  const base = demo ? "/demo/" + role : "/workspace";
  const screen = path[0] ?? "";
  return (
    <DataProvider key={base} demo={demo} role={role}>
      <AppShell base={base}>
        <Suspense fallback={<Loading />}>
          {!screen ? (
            <Dashboard base={base} />
          ) : screen === "requests" ? (
            path[1] === "new" ? (
              <RequestForm base={base} />
            ) : path[1] ? (
              <RequestDetail key={path[1]} base={base} id={path[1]} />
            ) : (
              <Requests base={base} />
            )
          ) : screen === "messages" ? (
            <Inbox base={base} />
          ) : screen === "calendar" ? (
            <Calendar base={base} />
          ) : (
            <Operations screen={screen} base={base} />
          )}
        </Suspense>
      </AppShell>
    </DataProvider>
  );
}
