import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-[520px] w-[520px] rounded-full bg-sky-500/20 blur-3xl" />
      </div>
      <div className="w-full max-w-md rounded-2xl border bg-card/70 backdrop-blur-xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 p-2.5 text-white shadow-lg">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Final Showdown
            </h1>
            <p className="text-xs text-muted-foreground">
              Job tracker for the crew
            </p>
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-1">
          Sign in to compete
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Only invited emails can get in. Use your allow-listed Google account.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" className="w-full" size="lg">
            <GoogleIcon className="h-4 w-4 mr-2" />
            Continue with Google
          </Button>
        </form>
        {error && (
          <p className="mt-4 text-sm text-rose-500">
            {error === "AccessDenied"
              ? "That email isn't on the invite list. Ask an admin to add you."
              : "Something went wrong. Please try again."}
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 6.5 2.3 2.1 6.8 2.1 12.3s4.4 10 9.9 10c5.7 0 9.5-4 9.5-9.7 0-.7-.1-1.2-.2-1.7H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.3l3.2 2.4C8 7.9 9.9 6.8 12 6.8c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 8.2 2.3 4.9 4.3 3.9 7.3z"
      />
      <path
        fill="#4A90E2"
        d="M12 22.3c2.7 0 5-.9 6.6-2.4l-3.1-2.5c-.8.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3l-3.2 2.5C4.3 20 7.8 22.3 12 22.3z"
      />
      <path
        fill="#FBBC05"
        d="M6.2 14.1c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8L3 8c-.7 1.3-1.1 2.8-1.1 4.3 0 1.5.4 3 1.1 4.3l3.2-2.5z"
      />
    </svg>
  );
}
