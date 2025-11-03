const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init && init.headers ? init.headers : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API ${path} failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as T;
}

export async function uploadFile(path: string, file: File): Promise<any> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: form, cache: 'no-store' });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}


