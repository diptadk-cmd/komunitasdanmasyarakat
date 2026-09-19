import React from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
const modulePath = '/assets/native-ui-20260915.mjs';
const { createTemplatePage } = await new Function('url', 'return import(url)')(modulePath);
const profile = { id: 'qa-form-local', role: 'sanggar', namaSanggar: 'Sanggar Uji Formulir', namaKetua: 'Ketua Pengujian', alamat: 'Jalan Pengujian No. 10, Jakarta', email: 'uji@example.test', noHp: '081200000000', jenisKesenian: ['Tari', 'Musik'], bentukKedudukan: 'mandiri-non-bh', legalitas: 'Non Badan Hukum' };
function useAdapter() {
  const [savedValues, setSaved] = React.useState({});
  return { profile, savedValues, save: async (key: string, values: Record<string, string>) => setSaved(old => ({ ...old, [key]: values })) };
}
const Page = createTemplatePage(React, null, useAdapter);
createRoot(document.getElementById('root')!).render(<div style={{ maxWidth: 1220, margin: 'auto', padding: 20 }}><Page /></div>);
