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
    <div className="relative isolate min-h-screen overflow-hidden flex flex-col">
      {/* Starting grid: five lanes, one per racer. Fades out below the fold. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
        aria-hidden
      >
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "20% 100%",
            backgroundPosition: "-1px 0",
          }}
        />
        <div className="grid grid-cols-5 pt-3 font-mono text-[10px] tracking-widest text-muted-foreground/60">
          {["P1", "P2", "P3", "P4", "P5"].map((p) => (
            <span key={p} className="text-center">
              {p}
            </span>
          ))}
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-backwards">
            <span className="rounded-md bg-primary p-1.5 text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight">
              Final Showdown
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight leading-[1.05] animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-backwards [animation-delay:60ms]">
            Five friends.
            <br />
            One job market.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-backwards [animation-delay:120ms]">
            One shared board for every application, referral, and follow-up —
            and a live scoreboard to keep it honest.
          </p>

          <form
            className="mt-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-backwards [animation-delay:180ms]"
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

          {error ? (
            <p className="mt-4 text-sm text-destructive">
              {error === "AccessDenied"
                ? "That email isn't on the league list. Ask an admin to add you."
                : "Something went wrong. Please try again."}
            </p>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground animate-in fade-in-0 duration-300 fill-mode-backwards [animation-delay:240ms]">
              Invite-only — sign in with your allow-listed Google account.
            </p>
          )}
        </div>
      </main>

      <footer className="p-6 text-center font-mono text-[10px] tracking-widest text-muted-foreground/60">
        PRIVATE LEAGUE · EST. 2026 · MAY THE BEST APPLICANT WIN
      </footer>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 6.5 2.3 2.1 6.8 2.1 12.3s4.4 10 9.9 10c5.7 0 9.5-4 9.5-9.7 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}
