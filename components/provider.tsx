"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { seedStore, DEMO_IDS } from "@/lib/seed";
import { applyDemoAction, scopeStore } from "@/lib/domain";
import type { Store, Action, Profile } from "@/lib/types";
const STORAGE = "net-tech-synthetic-demo-v1";
type Context = {
  store: Store | null;
  user: Profile | null;
  demo: boolean;
  error: string;
  loading: boolean;
  online: boolean;
  run: (action: Action) => Promise<{ id?: string }>;
  refresh: () => Promise<void>;
  reset: () => void;
};
const DataContext = createContext<Context | null>(null);
export function DataProvider({
  children,
  role,
  demo,
}: {
  children: ReactNode;
  role?: keyof typeof DEMO_IDS;
  demo: boolean;
}) {
  const [store, setStore] = useState<Store | null>(null),
    [user, setUser] = useState<Profile | null>(null),
    [error, setError] = useState(""),
    [online, setOnline] = useState(true),
    [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const requestId =
    parts[1] === "requests" && parts[2] !== "new" ? parts[2] : undefined;
  const screen = parts[1] ?? "";
  const refresh = useCallback(async () => {
    try {
      if (demo) {
        const raw = localStorage.getItem(STORAGE);
        const state: Store = raw ? JSON.parse(raw) : seedStore();
        if (!raw) localStorage.setItem(STORAGE, JSON.stringify(state));
        const me = state.profiles.find(
          (p) => p.id === DEMO_IDS[role ?? "client"],
        )!;
        setUser(me);
        setStore(scopeStore(state, me));
      } else {
        const response = await fetch(
          "/api/workspace?screen=" +
            encodeURIComponent(screen) +
            (requestId ? "&request=" + requestId : ""),
          { cache: "no-store" },
        );
        if (response.status === 401) {
          setStore(null);
          setUser(null);
          router.replace("/sign-in?expired=1");
          return;
        }
        const result = await response.json();
        if (response.status === 403) {
          setStore(null);
          setUser(null);
        }
        if (!response.ok)
          throw new Error(result.error ?? "Unable to load your workspace.");
        setStore(result.store);
        setUser(result.user);
      }
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load your workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [demo, role, router, requestId, screen]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const sync = () => {
        if (document.visibilityState === "visible") void refresh();
      },
      off = () => setOnline(false),
      on = () => {
        setOnline(true);
        void refresh();
      };
    window.addEventListener("storage", sync);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    window.addEventListener("focus", sync);
    const timer = demo ? null : setInterval(sync, 20000);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("storage", sync);
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
      window.removeEventListener("focus", sync);
      if (timer) clearInterval(timer);
    };
  }, [refresh, demo]);
  const run = async (action: Action) => {
    if (!navigator.onLine)
      throw new Error(
        "You are offline. Your changes have not been sent. Reconnect and try again.",
      );
    if (demo) {
      const state: Store = JSON.parse(
        localStorage.getItem(STORAGE) ?? JSON.stringify(seedStore()),
      );
      const result = applyDemoAction(state, DEMO_IDS[role ?? "client"], action);
      localStorage.setItem(STORAGE, JSON.stringify(result.store));
      await refresh();
      return { id: result.id };
    }
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error ?? "The change was not saved. Try again.");
    await refresh();
    return result;
  };
  return (
    <DataContext.Provider
      value={{
        store,
        user,
        demo,
        error,
        loading,
        online,
        run,
        refresh,
        reset: () => {
          if (demo) {
            localStorage.removeItem(STORAGE);
            void refresh();
          }
        },
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("Workspace context is missing");
  return ctx;
}
