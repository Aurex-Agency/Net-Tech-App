import { PublicEstimate } from "@/components/public-estimate";
export const dynamic = "force-dynamic";
export default function Estimate() {
  return (
    <PublicEstimate
      enabled={
        process.env.PUBLIC_INTAKE_ENABLED === "true" &&
        !!process.env.TURNSTILE_SECRET_KEY &&
        !!process.env.SUPABASE_SECRET_KEY
      }
    />
  );
}
