"use client";

/**
 * オンボーディングページ。
 * 組織を持たない新規ユーザーが初回ログイン後に到達するページ。
 * マウント時に /api/auth/me で needs_onboarding を確認し、
 * すでに組織を持つユーザーは /organizations へリダイレクトする。
 * ガード通過後に OnboardingWizard を描画する。
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  const router = useRouter();

  const [isGuardPassed, setIsGuardPassed] = useState(false);
  const [guardError, setGuardError] = useState<string | null>(null);

  useEffect(() => {
    async function checkGuard() {
      const res = await authFetch("/api/auth/me");
      // 401 は authFetch が /login へリダイレクト済み
      if (!res.ok) {
        setGuardError("サーバーへの接続に失敗しました");
        return;
      }
      const data = await res.json();
      if (!data.needs_onboarding) {
        // 既に組織を持つユーザーは組織一覧へ
        router.replace("/organizations");
        return;
      }
      setIsGuardPassed(true);
    }
    checkGuard();
  }, [router]);

  if (guardError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-red-500">{guardError}</p>
      </div>
    );
  }

  if (!isGuardPassed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <OnboardingWizard />
    </div>
  );
}
