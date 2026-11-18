"use client";

import { AlertCircle, Eye, EyeOff, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { Button, Input } from "@/components/ui";

export default function LoginForm({ next, expired }: { next: string; expired: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!username.trim() || !password) {
      setError("Нэвтрэх нэр, нууц үгээ оруулна уу.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", body: { username, password } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нэвтрэхэд алдаа гарлаа.");
      setPassword("");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
      {expired && !error && (
        <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
          Таны нэвтрэлтийн хугацаа дууссан тул дахин нэвтэрнэ үү.
        </p>
      )}
      {error && (
        <p role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <Input
        id="login-username"
        label="Нэвтрэх нэр"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoFocus
      />

      <Input
        id="login-password"
        label="Нууц үг"
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="grid h-8 w-8 place-items-center rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={showPassword ? "Нууц үг нуух" : "Нууц үг харуулах"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />

      <Button type="submit" fullWidth loading={submitting} loadingText="Шалгаж байна…">
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Нэвтрэх
      </Button>
    </form>
  );
}
