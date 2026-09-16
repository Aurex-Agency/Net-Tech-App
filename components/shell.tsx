"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  CalendarDays,
  Building2,
  Users,
  ChartNoAxesCombined,
  Settings,
  Clock3,
  LifeBuoy,
  ChevronDown,
  ArrowUpRight,
  Bell,
  Search,
  Menu,
  X,
  WifiOff,
  LogOut,
  FlaskConical,
} from "lucide-react";
import { useData } from "./provider";
import { isDispatch, isStaff, roleLabel } from "@/lib/types";
import { unreadCount } from "@/lib/domain";
import { initials } from "@/lib/format";
import { Alert, Loading } from "./ui";
export function AppShell({
  children,
  base,
}: {
  children: ReactNode;
  base: string;
}) {
  const { store, user, demo, loading, error, online, refresh } = useData();
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false),
    [notices, setNotices] = useState(false),
    [search, setSearch] = useState("");
  if (loading) return <Loading />;
  if (!store || !user)
    return (
      <main className="standalone">
        <Alert>{error || "Workspace unavailable"}</Alert>
        <button className="button" onClick={() => void refresh()}>
          Try again
        </button>
        <Link href="/sign-in">Sign in</Link>
      </main>
    );
  const dispatch = isDispatch(user.role),
    staff = isStaff(user.role);
  const unread = unreadCount(store, user.id);
  const nav = [
    {
      label: dispatch ? "Overview" : staff ? "Today" : "Home",
      slug: "",
      icon: LayoutDashboard,
    },
    {
      label: staff && !dispatch ? "My work" : "Requests",
      slug: "requests",
      icon: Inbox,
      count: store.requests.filter((r) => r.status === "new").length,
    },
    { label: "Messages", slug: "messages", icon: MessageSquare, count: unread },
    {
      label: staff ? "Calendar" : "Appointments",
      slug: "calendar",
      icon: CalendarDays,
    },
    {
      label: dispatch ? "Clients" : staff ? "Time entries" : "Organization",
      slug: dispatch ? "clients" : staff ? "time" : "organization",
      icon: dispatch ? Building2 : staff ? Clock3 : Building2,
    },
    ...(dispatch
      ? [
          { label: "Team", slug: "team", icon: Users },
          { label: "Reports", slug: "reports", icon: ChartNoAxesCombined },
        ]
      : []),
  ];
  const active =
    nav.find((n) =>
      n.slug ? path.startsWith(base + "/" + n.slug) : path === base,
    )?.label ?? "Workspace";
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link
          href={base}
          className="brand"
          aria-label={store.settings.company_name + " home"}
        >
          <Image src="/net-tech-mark.png" alt="" width={32} height={36} />
          <span>
            NET<span className="brand-hyphen">-</span>TECH<small>CONNECT</small>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-mark">
            {staff ? "NT" : initials(store.organizations[0]?.name ?? "Client")}
          </span>
          <span>
            {dispatch
              ? "Net-Tech operations"
              : staff
                ? "Team workspace"
                : (store.organizations[0]?.name ?? "Client workspace")}
            <small>
              {user.role === "owner"
                ? "Owner workspace"
                : dispatch
                  ? "Dispatcher workspace"
                  : staff
                    ? "Technician workspace"
                    : "Client workspace"}
            </small>
          </span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ label, slug, icon: Icon, count }) => (
            <Link
              key={slug}
              href={base + (slug ? "/" + slug : "")}
              className={`nav-item ${active === label ? "active" : ""}`}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {!!count && <span className="nav-count">{count}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-box">
            <span className="support-symbol">
              <LifeBuoy size={21} />
            </span>
            <strong>
              {dispatch
                ? "Keep service moving."
                : staff
                  ? "Keep the client in the loop."
                  : "A little help goes a long way."}
            </strong>
            <p>
              {dispatch
                ? "Review unassigned work and coordinate the team."
                : staff
                  ? "Reply to clients or add internal notes on your assigned work."
                  : "Your Net-Tech team is a message away."}
            </p>
            <Link
              href={`${base}/${dispatch ? "requests?filter=unassigned" : staff ? "messages" : "requests/new?kind=general"}`}
            >
              {dispatch
                ? "Review queue"
                : staff
                  ? "Open conversations"
                  : "Get in touch"}{" "}
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <Link
            className={`nav-item ${path.endsWith("/settings") ? "active" : ""}`}
            href={`${base}/${user.role === "owner" ? "settings" : "account"}`}
          >
            <Settings size={19} />
            {user.role === "owner" ? "Settings" : "Account settings"}
          </Link>
          <Link className="user-block" href={`${base}/account`}>
            <span className="avatar avatar-blue">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{roleLabel[user.role]}</small>
            </span>
            <ChevronDown size={14} />
          </Link>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{active}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`${base}/requests?q=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search requests"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search requests…"
              />
              <kbd>↵</kbd>
            </form>
            <button
              className={`icon-button notification-bell ${store.notifications.some((n) => !n.read_at) ? "has-notifications" : ""}`}
              aria-label="Notifications"
              aria-expanded={notices}
              onClick={() => setNotices(!notices)}
            >
              <Bell size={20} />
            </button>
            <Link
              href={`${base}/account`}
              className="avatar avatar-small"
              aria-label="Your account"
            >
              {initials(user.name)}
            </Link>
          </div>
          {notices && (
            <div className="notification-panel">
              <h3>Notifications</h3>
              {store.notifications.length ? (
                store.notifications.slice(0, 8).map((n) => (
                  <Link
                    key={n.id}
                    href={`${base}/requests/${n.request_id}`}
                    onClick={() => setNotices(false)}
                  >
                    {n.title}
                    <small>Open conversation</small>
                  </Link>
                ))
              ) : (
                <p>You’re all caught up.</p>
              )}
            </div>
          )}
        </header>
        {demo && (
          <div className="demo-bar">
            <span>
              <FlaskConical size={14} />
              <strong>Interactive demo</strong>
              <span className="demo-detail">
                Synthetic data · nothing is sent to Net-Tech
              </span>
            </span>
            <label>
              View as
              <select
                aria-label="Demo role"
                value={base.split("/")[2]}
                onChange={(e) => {
                  setMenu(false);
                  router.push("/demo/" + e.target.value);
                }}
              >
                <option value="client">Client</option>
                <option value="technician">Technician</option>
                <option value="owner">Owner</option>
              </select>
            </label>
          </div>
        )}
        {!online && (
          <div className="offline-banner" role="status">
            <WifiOff size={17} />
            You’re offline. Reconnect before sending messages or saving changes.
          </div>
        )}
        {error && (
          <Alert>
            {error} <button onClick={() => void refresh()}>Retry</button>
          </Alert>
        )}
        <main id="main-content" tabIndex={-1} className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            {store.settings.company_name} <span>•</span> Technology. Handled.
          </span>
          <span>
            All times Central <span>•</span>{" "}
            {demo
              ? "Demo workspace"
              : staff
                ? "Secure team workspace"
                : "Secure client portal"}
          </span>
        </footer>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {nav.slice(0, 3).map(({ label, slug, icon: Icon }) => (
            <Link
              key={slug}
              className={active === label ? "active" : ""}
              href={base + (slug ? "/" + slug : "")}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
          <button onClick={() => setMenu(true)}>
            <Menu size={20} />
            More
          </button>
        </nav>
      </div>
    </div>
  );
}
export function SignOut() {
  const router = useRouter();
  const { demo } = useData();
  return (
    <button
      className="button secondary"
      onClick={async () => {
        if (demo) {
          router.push("/sign-in");
          return;
        }
        await fetch("/auth/sign-out", { method: "POST" });
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      <LogOut size={16} />
      {demo ? "Leave demo" : "Sign out"}
    </button>
  );
}
