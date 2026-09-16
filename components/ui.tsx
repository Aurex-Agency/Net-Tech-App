"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowRight, Inbox, LoaderCircle, AlertCircle } from "lucide-react";
import {
  statusLabel,
  visitLabel,
  type RequestStatus,
  type VisitStatus,
} from "@/lib/types";
export function Badge({
  status,
  staff = false,
}: {
  status: RequestStatus | VisitStatus;
  staff?: boolean;
}) {
  return (
    <span className={`badge status-${status}`}>
      <span className="status-dot" />
      {staff && status === "waiting_client"
        ? "Waiting on client"
        : (statusLabel[status as RequestStatus] ??
          visitLabel[status as VisitStatus] ??
          status)}
    </span>
  );
}
export function Empty({
  title = "Nothing here yet",
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Loading your workspace…
    </div>
  );
}
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="alert" role="alert">
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const focused = document.activeElement as HTMLElement;
    el?.showModal();
    return () => {
      el?.close();
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={15} />
    </button>
  );
}
