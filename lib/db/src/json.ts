import { customType } from "drizzle-orm/mysql-core";

// MariaDB menyimpan JSON sebagai LONGTEXT, sehingga driver mysql2 mengembalikan
// nilai berupa string mentah (berbeda dengan jsonb PostgreSQL yang otomatis
// ter-parse). Custom type ini memastikan kolom JSON selalu di-serialize saat
// menulis dan di-parse menjadi objek saat membaca, agar bentuk data konsisten.
export const json = <TData>(name: string) =>
  customType<{ data: TData; driverData: string }>({
    dataType() {
      return "json";
    },
    toDriver(value: TData): string {
      return JSON.stringify(value);
    },
    fromDriver(value: unknown): TData {
      if (typeof value === "string") {
        try {
          return JSON.parse(value) as TData;
        } catch {
          return value as TData;
        }
      }
      return value as TData;
    },
  })(name);
