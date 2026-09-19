export interface DemoLoginAccount {
  label: string;
  username: string;
  password: string;
  role: string;
  scenario: string;
}

// Satu-satunya akun demo yang dipertahankan. Akun Kurator hanya digunakan
// melalui Konsol Kurator dan tidak ditampilkan pada login aplikasi utama.
export const DEMO_LOGIN_ACCOUNTS: readonly DemoLoginAccount[] = [
  {
    label: "Kurator · Utama",
    username: "demo.kurator",
    password: "DEMO_DISABLED",
    role: "kurator",
    scenario: "Utama",
  },
];
