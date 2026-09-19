import { BackButton } from "@/components/layout/BackButton";
import { RegistrationAgreementContent } from "@/components/legal/RegistrationAgreementContent";
import { HighContrastToggle } from "@/components/system/HighContrastToggle";
import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";

function LegalLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <BackButton to="/daftar" label="Kembali ke Pendaftaran" />
          <HighContrastToggle />
        </div>
        <h1 className="mt-6 font-serif text-3xl font-bold text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
        <Card className="mt-6 p-5 sm:p-8">{children}</Card>
      </div>
    </main>
  );
}

export function TermsAndConditionsPage() {
  return (
    <LegalLayout
      title="Syarat dan Ketentuan JakSanggar"
      description="Ketentuan pendaftaran dan penggunaan layanan JakSanggar."
    >
      <RegistrationAgreementContent />
    </LegalLayout>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Kebijakan Privasi JakSanggar"
      description="Ringkasan tujuan dan tanggung jawab pemrosesan data pribadi dalam layanan JakSanggar."
    >
      <div className="space-y-4 text-sm leading-6 text-muted-foreground">
        <p>
          Data pribadi dikumpulkan dan diproses secara terbatas untuk
          pendaftaran dan verifikasi akun, penyediaan serta pengembangan
          layanan, komunikasi dengan pengguna, keamanan akun dan sistem,
          fasilitasi kegiatan atau transaksi, penanganan pengaduan, serta
          pemenuhan kewajiban hukum.
        </p>
        <p>
          Pengguna bertanggung jawab memastikan bahwa data pribadi milik
          anggota, peserta, perempuan, anak, atau pihak lain yang diunggah telah
          diperoleh dan digunakan secara sah. Apabila data melibatkan anak,
          persetujuan orang tua atau wali yang sah wajib diperoleh apabila
          diperlukan.
        </p>
        <p>
          Permintaan atau pengaduan mengenai data pribadi dapat disampaikan ke{" "}
          <a
            className="font-medium text-primary underline underline-offset-4"
            href="mailto:pengaduan@komunitasdanmasyarakat.com"
          >
            pengaduan@komunitasdanmasyarakat.com
          </a>{" "}
          atau WhatsApp 0813-8882-691.
        </p>
      </div>
    </LegalLayout>
  );
}
