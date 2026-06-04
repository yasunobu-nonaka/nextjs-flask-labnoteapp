import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-5xl font-bold tracking-tight">Lab Note App</h1>
        <p className="text-xl text-gray-500">
          直感的な実験ノートで、チームメンバーと実験記録を共有しよう
        </p>
        <div className="flex flex-col gap-4 mt-4">
          <Link
            href="/register"
            className="px-6 py-3 rounded-lg bg-foreground text-background font-semibold hover:opacity-80 transition-opacity"
          >
            Register
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg border border-foreground text-foreground font-semibold hover:bg-foreground hover:text-background transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}
