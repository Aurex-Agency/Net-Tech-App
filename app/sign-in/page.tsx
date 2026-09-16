import { Suspense } from "react";
import { AuthForm } from "@/components/auth";
export default function SignIn() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
