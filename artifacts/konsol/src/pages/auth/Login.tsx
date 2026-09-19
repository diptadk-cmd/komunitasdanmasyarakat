import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  GoldDustField,
  PucukRebungDivider,
  TumpalSpinner,
} from "@/components/betawi/Ornaments";
import brandSeal from "@/assets/brand/jak-sanggar-seal.png";
import { HighContrastToggle } from "@/components/system/HighContrastToggle";
import { mainAppUrl } from "@/lib/app-links";
import { CURATOR_DEMO_ACCOUNT } from "@/lib/demo-accounts";
import { load, LOCAL_DEMO_USERNAMES } from "@/lib/store";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const showDemoAccounts =
    import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true" && isLocalHost;

  const submitCredentials = async (
    loginUsername: string,
    loginPassword: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const u = await login(loginUsername.trim(), loginPassword);
      if (!u) {
        toast({
          title: "Gagal masuk",
          description: "Username atau password tidak cocok.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: `Selamat datang, ${u.username}` });
      navigate("/");
    } catch (err) {
      const pesan =
        err instanceof Error && err.message
          ? err.message
          : "Server tidak dapat dihubungi.";
      toast({
        title: "Gagal masuk",
        description: pesan,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitCredentials(username, password);
  };

  const onDemoLogin = async () => {
    if (!CURATOR_DEMO_ACCOUNT || busy) return;
    setUsername(CURATOR_DEMO_ACCOUNT.username);
    setPassword(CURATOR_DEMO_ACCOUNT.password);
    await submitCredentials(
      CURATOR_DEMO_ACCOUNT.username,
      CURATOR_DEMO_ACCOUNT.password,
    );
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-6"
      style={{
        background:
          "linear-gradient(145deg, hsl(155 42% 12%) 0%, hsl(152 38% 18%) 50%, hsl(148 30% 24%) 100%)",
      }}
    >
      <img
        src={brandSeal}
        alt=""
        aria-hidden="true"
        className="absolute right-[-40px] top-[-40px] h-72 w-72 object-contain opacity-15 pointer-events-none"
      />
      <img
        src={brandSeal}
        alt=""
        aria-hidden="true"
        className="absolute left-[-50px] bottom-[-50px] h-80 w-80 object-contain opacity-10 pointer-events-none"
      />
      <GoldDustField count={20} />
      <div className="relative w-full max-w-md">
        <div
          className="relative rounded-2xl p-8 bg-white border border-[hsl(40_30%_80%)] shadow-2xl"
          style={{
            boxShadow:
              "0 25px 50px -10px hsl(155 40% 8% / 0.45), 0 0 0 1px hsl(40 50% 55% / 0.25), 0 0 50px hsl(40 72% 48% / 0.12)",
          }}
        >
          <HighContrastToggle className="absolute top-3 right-3" />
          <div className="flex flex-col items-center gap-3 mb-6 text-center">
            <img
              src={brandSeal}
              alt="Jak Sanggar"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-[hsl(40_72%_48%)] shadow-lg"
            />
            <div>
              <div className="font-serif text-xl leading-tight text-[hsl(155_28%_14%)]">
                Konsol Kurator
              </div>
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[hsl(150_10%_38%)]">
                Jak Sanggar
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1 justify-center">
            <ShieldCheck className="h-4 w-4 text-[hsl(40_72%_42%)]" />
            <span className="text-[10px] uppercase tracking-[0.24em] text-[hsl(40_72%_42%)] font-semibold">
              Akses Khusus Kurator
            </span>
          </div>
          <h1 className="font-serif text-2xl text-center text-[hsl(155_28%_14%)]">
            Masuk Konsol
          </h1>
          <p className="text-sm text-[hsl(150_10%_38%)] mt-1.5 text-center">
            Konsol ini hanya untuk akun Kurator. Peran lain silakan masuk lewat{" "}
            <a
              href={mainAppUrl()}
              className="text-[hsl(40_72%_38%)] hover:underline"
            >
              aplikasi utama
            </a>
            .
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="u"
                className="text-xs uppercase tracking-wider text-[hsl(150_10%_38%)]"
              >
                Username
              </Label>
              <Input
                id="u"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username kurator"
                required
                data-testid="input-username"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="p"
                className="text-xs uppercase tracking-wider text-[hsl(150_10%_38%)]"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="p"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={
                    show ? "Sembunyikan password" : "Tampilkan password"
                  }
                  aria-pressed={show}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  {show ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full btn-gold border-0 h-11 text-sm font-semibold tracking-wide"
              data-testid="button-login"
            >
              {busy ? (
                <TumpalSpinner size={18} />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {busy ? "Memverifikasi..." : "Masuk Konsol"}
            </Button>
          </form>

          {showDemoAccounts && CURATOR_DEMO_ACCOUNT && (
            <div className="mt-4 rounded-xl border border-[hsl(40_55%_68%)] bg-[hsl(40_75%_93%)] p-3">
              <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(40_65%_30%)]">
                Akses demo sekali klik
              </div>
              <p data-testid="demo-account-readiness" className="mb-2 text-xs text-center">
                {load().users.some((account) => account.username === CURATOR_DEMO_ACCOUNT.username && LOCAL_DEMO_USERNAMES.has(account.username.toLowerCase())) ? "Akun demo lokal siap digunakan" : "Akun demo belum tersedia pada data browser ini"}
              </p>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void onDemoLogin()}
                data-testid="button-demo-kurator"
                className="h-11 w-full border-0 bg-[hsl(155_38%_22%)] text-sm font-semibold text-white hover:bg-[hsl(155_42%_17%)]"
              >
                <ShieldCheck className="h-4 w-4" />
                Masuk sebagai Kurator Demo
              </Button>
            </div>
          )}

          <div className="mt-6">
            <PucukRebungDivider className="opacity-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
