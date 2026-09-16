"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useData } from "./provider";
import { PageHeading, SectionHead, Alert, Loading } from "./ui";
import { isStaff, type Store } from "@/lib/types";
import { csvCell, download } from "@/lib/format";
type Report = {
  requests: number;
  first_response_hours: number | null;
  resolution_hours: number | null;
  reopened: number;
  categories: { category: string; count: number }[];
  backlog: number[];
  visits: number;
  minutes: number;
};
function fromDemo(s: Store): Report {
  const replies = s.requests.flatMap((r) => {
    const first = s.messages
      .filter(
        (m) =>
          m.request_id === r.id &&
          s.profiles.some((p) => p.id === m.author_id && isStaff(p.role)),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    return first
      ? [(+new Date(first.created_at) - +new Date(r.created_at)) / 3600000]
      : [];
  });
  const resolved = s.requests.filter(
    (r) => r.resolved_at && ["resolved", "closed"].includes(r.status),
  );
  const averages = (a: number[]) =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  return {
    requests: s.requests.length,
    first_response_hours: averages(replies),
    resolution_hours: averages(
      resolved.map(
        (r) => (+new Date(r.resolved_at!) - +new Date(r.created_at)) / 3600000,
      ),
    ),
    reopened: s.requests.filter((r) => r.reopen_count > 0).length,
    categories: [...new Set(s.requests.map((r) => r.category))].map(
      (category) => ({
        category,
        count: s.requests.filter((r) => r.category === category).length,
      }),
    ),
    backlog: [
      [0, 1],
      [1, 3],
      [3, 7],
      [7, Infinity],
    ].map(
      ([min, max]) =>
        s.requests.filter(
          (r) =>
            !["resolved", "closed", "canceled"].includes(r.status) &&
            (+new Date() - +new Date(r.created_at)) / 86400000 >= min &&
            (+new Date() - +new Date(r.created_at)) / 86400000 < max,
        ).length,
    ),
    visits: s.appointments.filter((a) => a.status === "completed").length,
    minutes: s.work_entries.reduce((sum, e) => sum + e.minutes, 0),
  };
}
export function Reports() {
  const { store, demo } = useData();
  const [remote, setRemote] = useState<Report | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch("/api/reports", { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setRemote(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Reports unavailable");
      });
    return () => controller.abort();
  }, [demo]);
  if (!store) return null;
  const report = demo ? fromDemo(store) : remote;
  return (
    <>
      <PageHeading
        eyebrow="THE BIGGER PICTURE"
        title="Service reports"
        description="All authorized service history. Calendar-time measures, with reopened work shown separately."
        actions={
          <button
            className="button secondary"
            onClick={async () => {
              try {
                if (demo) {
                  download(
                    "net-tech-demo-requests.csv",
                    [
                      [
                        "Reference",
                        "Title",
                        "Status",
                        "Created",
                        "Resolved",
                        "Reopened",
                      ],
                      ...store.requests.map((r) => [
                        r.reference,
                        r.title,
                        r.status,
                        r.created_at,
                        r.resolved_at,
                        r.reopen_count,
                      ]),
                    ]
                      .map((row) => row.map(csvCell).join(","))
                      .join("\r\n"),
                  );
                } else {
                  const response = await fetch("/api/export");
                  if (!response.ok)
                    throw new Error("Export failed. Please retry.");
                  download("net-tech-requests.csv", await response.text());
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : "Export failed");
              }
            }}
          >
            <Download size={16} />
            Export requests
          </button>
        }
      />
      {error && <Alert>{error}</Alert>}
      {report ? (
        <>
          <div className="report-stats">
            {[
              ["Requests", String(report.requests), "All service requests"],
              [
                "First staff response",
                report.first_response_hours !== null
                  ? Number(report.first_response_hours).toFixed(1) + "h"
                  : "—",
                "First human public reply",
              ],
              [
                "Time to resolution",
                report.resolution_hours !== null
                  ? Number(report.resolution_hours).toFixed(1) + "h"
                  : "—",
                "Creation to latest resolution",
              ],
              ["Reopened", String(report.reopened), "Reported separately"],
            ].map(([label, value, caption]) => (
              <div className="panel report-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{caption}</small>
              </div>
            ))}
          </div>
          <div className="two-column">
            <section className="panel">
              <SectionHead title="Work by category" />
              {report.categories.map((c) => (
                <div className="category-report" key={c.category}>
                  <span>
                    {c.category}
                    <strong>{c.count}</strong>
                  </span>
                  <div>
                    <i
                      style={{
                        width: `${(c.count / Math.max(report.requests, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>
            <section className="panel">
              <SectionHead
                title="Open backlog"
                subtitle="Age is not a service-level breach."
              />
              {["Under 1 day", "1–3 days", "3–7 days", "Over 7 days"].map(
                (label, i) => (
                  <div className="report-row" key={label}>
                    <span>{label}</span>
                    <strong>{report.backlog[i]}</strong>
                  </div>
                ),
              )}
              <div className="report-row">
                <span>Visits completed</span>
                <strong>{report.visits}</strong>
              </div>
              <div className="report-row">
                <span>Logged service time</span>
                <strong>{(report.minutes / 60).toFixed(1)} h</strong>
              </div>
            </section>
          </div>
        </>
      ) : (
        !error && <Loading />
      )}
    </>
  );
}
