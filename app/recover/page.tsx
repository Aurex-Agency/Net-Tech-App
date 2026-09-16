import { Suspense } from "react";
import { AuthForm } from "@/components/auth";
export default function Recovery() {
  return (
    <Suspense>
      <AuthForm recovery />
    </Suspense>
  );
}
