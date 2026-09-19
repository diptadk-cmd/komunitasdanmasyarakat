import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_KURASI_PARTICIPANTS,
  parseKurasiParticipants,
} from "./kurasi-participants";

function participant(index: number) {
  const id = String(index).padStart(12, "0");
  return {
    userId: `seniman-${index}`,
    username: `seniman.${index}`,
    nama: `Seniman ${index}`,
    jenisKesenian: "Tari",
    nik: `3174${id}`,
    ktpUrl: `/api/uploads/00000000-0000-4000-8000-${id}/raw`,
    selfieUrl: `/api/uploads/10000000-0000-4000-8000-${id}/raw`,
  };
}

test("kurasi menerima paling banyak delapan peserta lengkap", () => {
  const value = Array.from({ length: MAX_KURASI_PARTICIPANTS }, (_, index) =>
    participant(index + 1),
  );
  assert.equal(parseKurasiParticipants(value)?.length, 8);
});

test("kurasi menolak NIK atau akun peserta yang sama", () => {
  const duplicateNik = Array.from({ length: 5 }, (_, index) =>
    participant(index + 1),
  );
  duplicateNik[4]!.nik = duplicateNik[0]!.nik;
  assert.equal(parseKurasiParticipants(duplicateNik), null);

  const duplicateAccount = Array.from({ length: 5 }, (_, index) =>
    participant(index + 1),
  );
  duplicateAccount[4]!.username = duplicateAccount[0]!.username;
  assert.equal(parseKurasiParticipants(duplicateAccount), null);
});

test("kurasi mewajibkan NIK 16 digit, KTP, dan selfie memegang KTP", () => {
  const invalid = Array.from({ length: 5 }, (_, index) =>
    participant(index + 1),
  );
  invalid[0]!.nik = "123";
  invalid[1]!.selfieUrl = "";
  assert.equal(parseKurasiParticipants(invalid), null);
});
