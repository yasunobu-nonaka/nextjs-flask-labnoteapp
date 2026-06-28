"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";

// ユーザー名変更フォーム
function ChangeUsernameForm({
  editName,
  handleSave,
  onEditNameChange,
  onCancel,
  saveError,
  saveSuccess,
  isSaving,
  savedUsername,
}: {
  editName: string;
  handleSave: (e: React.SyntheticEvent) => void;
  onEditNameChange: (e: string) => void;
  onCancel: () => void;
  saveError: string | null;
  saveSuccess: boolean;
  isSaving: boolean;
  savedUsername: string;
}) {
  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3">
      <input
        value={editName}
        onChange={(e) => {
          onEditNameChange(e.target.value);
        }}
        placeholder="ユーザー名"
        className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
      />
      {saveError && <p className="text-sm text-red-500">{saveError}</p>}
      {saveSuccess && (
        <p className="text-sm text-green-600 dark:text-green-400">
          保存しました
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-base hover:opacity-80 transition-opacity"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={
            isSaving || !editName.trim() || editName.trim() === savedUsername
          }
          className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

// メールアドレス変更フォーム
function ChangeEmailForm({
  editEmail,
  onEditEmailChange,
  onSubmit,
  onCancel,
  isEmailSaving,
  emailSaveError,
  savedEmail,
}: {
  editEmail: string;
  onEditEmailChange: (value: string) => void;
  onSubmit: (e: React.SyntheticEvent) => void;
  onCancel: () => void;
  isEmailSaving: boolean;
  emailSaveError: string | null;
  savedEmail: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        value={editEmail}
        onChange={(e) => onEditEmailChange(e.target.value)}
        placeholder="新しいメールアドレス"
        className="px-3 py-2 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-foreground"
      />
      {emailSaveError && (
        <p className="text-sm text-red-500">{emailSaveError}</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-base hover:opacity-80 transition-opacity"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={
            isEmailSaving ||
            !editEmail.trim() ||
            editEmail.trim() === savedEmail
          }
          className="px-4 py-2 rounded-lg bg-foreground text-background text-base font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isEmailSaving ? "送信中..." : "確認メールを送信"}
        </button>
      </div>
    </form>
  );
}

export default function SettingHomePage() {
  // 保存済みのユーザー名: 変更前との比較に使う
  const [savedUsername, setSavedUsername] = useState("");

  // ユーザー名編集フォームの表示状態と入力値・保存状態
  const [isChangingUsername, setIsChangingUsername] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 現在のメールアドレス（表示用）
  const [savedEmail, setSavedEmail] = useState("");

  // メールアドレス編集フォームの表示状態と入力値・送信状態
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [isEmailSaving, setIsEmailSaving] = useState(false);
  const [emailSaveError, setEmailSaveError] = useState<string | null>(null);
  // true のとき確認メール送信済みメッセージを表示する
  const [emailSendSuccess, setEmailSendSuccess] = useState(false);

  useEffect(() => {
    authFetch("/api/auth/me").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setSavedUsername(data.username);
        setEditName(data.username);
        setSavedEmail(data.email);
        setEditEmail(data.email);
      }
    });
  }, []);

  async function handleEmailSave(e: React.SyntheticEvent) {
    e.preventDefault();
    const trimmed = editEmail.trim();
    if (!trimmed || trimmed === savedEmail) return;

    setIsEmailSaving(true);
    setEmailSaveError(null);
    try {
      const res = await authFetch("/api/auth/me/email", {
        method: "PATCH",
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEmailSaveError(json.message ?? "送信に失敗しました");
        return;
      }
      /* 送信成功後はフォームを閉じてメッセージを表示する */
      setIsChangingEmail(false);
      setEmailSendSuccess(true);
    } catch {
      setEmailSaveError("サーバーへの接続に失敗しました");
    } finally {
      setIsEmailSaving(false);
    }
  }

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === savedUsername) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await authFetch("/api/auth/me/username", {
        method: "PATCH",
        body: JSON.stringify({ username: trimmed }),
      });
      if (!res.ok) {
        const json = await res.json();
        setSaveError(json.message ?? "保存に失敗しました");
        return;
      }
      const json = await res.json();
      setSavedUsername(json.username);
      setEditName(json.username);
      setSaveSuccess(true);
      /* 保存成功後はフォームを閉じる */
      setIsChangingUsername(false);
    } catch {
      setSaveError("サーバーへの接続に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-xl flex flex-col gap-8">
      <h2 className="text-2xl font-bold">基本設定</h2>
      {/* ユーザー名編集セクション */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">ユーザー名</h3>
        {isChangingUsername ? (
          /* 「名前変更」押下後: 変更フォームを表示する */
          <ChangeUsernameForm
            editName={editName}
            handleSave={handleSave}
            onEditNameChange={(value) => {
              setEditName(value);
              setSaveSuccess(false);
            }}
            onCancel={() => {
              setIsChangingUsername(false);
              setEditName(savedUsername);
              setSaveError(null);
            }}
            saveError={saveError}
            saveSuccess={saveSuccess}
            isSaving={isSaving}
            savedUsername={savedUsername}
          />
        ) : (
          /* デフォルト: 現在のユーザー名と変更ボタンを表示する */
          <div className="flex items-center gap-4">
            <p>{savedUsername}</p>
            <button
              onClick={() => setIsChangingUsername(true)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-base hover:opacity-80 transition-opacity"
            >
              名前変更
            </button>
          </div>
        )}
      </section>

      {/* メールアドレス変更セクション */}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">メールアドレス</h3>
        {isChangingEmail ? (
          /* 「メールアドレス変更」押下後: 変更フォームを表示する */
          <ChangeEmailForm
            editEmail={editEmail}
            onEditEmailChange={(value) => {
              setEditEmail(value);
              setEmailSaveError(null);
            }}
            onSubmit={handleEmailSave}
            onCancel={() => {
              setIsChangingEmail(false);
              setEditEmail(savedEmail);
              setEmailSaveError(null);
            }}
            isEmailSaving={isEmailSaving}
            emailSaveError={emailSaveError}
            savedEmail={savedEmail}
          />
        ) : (
          /* デフォルト: 現在のメールアドレスと変更ボタンを表示する */
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {savedEmail}
              </p>
              <button
                onClick={() => {
                  setIsChangingEmail(true);
                  setEmailSendSuccess(false);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-base hover:opacity-80 transition-opacity"
              >
                メールアドレス変更
              </button>
            </div>
            {/* 確認メール送信後はメッセージを表示する */}
            {emailSendSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">
                確認メールを送信しました。メール内のリンクをクリックして変更を確定してください。
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
