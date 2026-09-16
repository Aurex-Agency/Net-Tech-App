import { Suspense } from "react";
import { AuthForm } from "@/components/auth";
export default function Invitation() {
  return (
    <Suspense>
      <AuthForm invite />
    </Suspense>
  );
}
