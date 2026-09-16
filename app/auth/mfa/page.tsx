import { Suspense } from "react";
import { MfaForm } from "@/components/auth";
export default function MfaPage() {
  return (
    <Suspense>
      <MfaForm />
    </Suspense>
  );
}
