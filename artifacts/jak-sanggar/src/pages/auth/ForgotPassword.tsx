import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BackButton } from "@/components/layout/BackButton";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Mail } from "lucide-react";
import { HighContrastToggle } from "@/components/system/HighContrastToggle";
import {
  ApiError,
  MIN_ACCOUNT_PASSWORD_LENGTH,
  passwordResetApi,
} from "@/lib/api";

type Step = "email" | "otp" | "newpw" | "done";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [requestId, setRequestId] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const sendOtp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (busy || !isValidEmail(normalizedEmail)) return;
    setBusy(true);
    try {
      const result = await passwordResetApi.request(normalizedEmail);
      setRequestId(result.requestId);
      setOtp("");
      setStep("otp");
      toast({
        title: "Periksa email Anda",
        description: "Jika email terdaftar, kode OTP akan segera dikirim.",
      });
      if (result.devOtp) {
        toast({
          title: "Kode OTP development",
          description: result.devOtp,
        });
      }
    } catch (error) {
      toast({
        title: "OTP belum dapat dikirim",
        description: errorMessage(
          error,
          "Layanan pemulihan sedang tidak tersedia.",
        ),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (busy || !requestId || !/^\d{6}$/.test(otp)) return;
    setBusy(true);
    try {
      const result = await passwordResetApi.verify(requestId, otp);
      setResetToken(result.resetToken);
      setStep("newpw");
    } catch (error) {
      toast({
        title: "OTP tidak dapat diverifikasi",
        description: errorMessage(error, "Kode salah atau sudah kedaluwarsa."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (pw.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
      toast({
        title: `Password minimal ${MIN_ACCOUNT_PASSWORD_LENGTH} karakter`,
        variant: "destructive",
      });
      return;
    }
    if (pw !== pw2) {
      toast({ title: "Konfirmasi tidak cocok", variant: "destructive" });
      return;
    }
    if (busy || !requestId || !resetToken) return;
    setBusy(true);
    try {
      await passwordResetApi.confirm(requestId, resetToken, pw);
      setOtp("");
      setPw("");
      setPw2("");
      setResetToken("");
      setStep("done");
    } catch (error) {
      toast({
        title: "Password belum tersimpan",
        description: errorMessage(error, "Sesi pemulihan sudah kedaluwarsa."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md p-8 relative">
        <HighContrastToggle className="absolute top-3 right-3" />
        <BackButton to="/" label="Kembali ke Login" />
        <h1 className="mt-3 font-serif text-2xl">Lupa Password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pulihkan akun melalui kode OTP yang dikirim ke email terdaftar.
        </p>

        {step === "email" && (
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Email Terdaftar</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@contoh.id"
                inputMode="email"
                autoComplete="email"
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={sendOtp}
              disabled={busy || !isValidEmail(email)}
            >
              <Mail className="h-4 w-4" />
              {busy ? "Mengirim..." : "Kirim OTP"}
            </Button>
          </div>
        )}

        {step === "otp" && (
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-otp">Kode OTP (6 digit)</Label>
              <Input
                id="reset-otp"
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, ""))
                }
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="tracking-[0.5em] text-center text-lg"
              />
            </div>
            <Button
              className="w-full"
              onClick={verifyOtp}
              disabled={busy || !/^\d{6}$/.test(otp)}
            >
              {busy ? "Memverifikasi..." : "Verifikasi OTP"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setStep("email")}
              disabled={busy}
            >
              Ganti email atau kirim ulang
            </Button>
          </div>
        )}

        {step === "newpw" && (
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">Password Baru</Label>
              <Input
                id="reset-password"
                type="password"
                value={pw}
                onChange={(event) => setPw(event.target.value)}
                autoComplete="new-password"
                minLength={MIN_ACCOUNT_PASSWORD_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                Gunakan minimal {MIN_ACCOUNT_PASSWORD_LENGTH} karakter.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-password-confirm">
                Konfirmasi Password
              </Label>
              <Input
                id="reset-password-confirm"
                type="password"
                value={pw2}
                onChange={(event) => setPw2(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button className="w-full" onClick={reset} disabled={busy}>
              <KeyRound className="mr-2 h-4 w-4" />
              {busy ? "Menyimpan..." : "Simpan Password Baru"}
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-md bg-secondary p-4 text-sm">
              Password berhasil diperbarui dan seluruh sesi lama sudah dicabut.
            </div>
            <Link href="/">
              <Button className="w-full">Kembali ke Halaman Login</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
