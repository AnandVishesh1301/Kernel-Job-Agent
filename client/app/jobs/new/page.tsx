'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Button, Card, CardBody, CardHeader } from '../../../components/ui';

export default function NewJobPage() {
  const [url, setUrl] = useState('');
  const [resumes, setResumes] = useState<any[]>([]);
  const [resumeId, setResumeId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api('/resumes').then((r: any) => setResumes(r.items ?? r)).catch(() => setResumes([]));
  }, []);

  async function onCreate() {
    setError(null);
    setCreating(true);
    try {
      const job = await api<any>('/jobs', { method: 'POST', body: JSON.stringify({ url, resume_id: resumeId }) });
      setCreatedId(job.id);
      await api(`/jobs/${job.id}/run`, { method: 'POST' });
    } catch (e: any) {
      setError(e.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>New Job</CardHeader>
        <CardBody>
          <div className="flex flex-col gap-3 max-w-xl">
            <input className="border rounded px-3 py-2" placeholder="Job URL" value={url} onChange={e => setUrl(e.target.value)} />
            <select className="border rounded px-3 py-2" value={resumeId} onChange={e => setResumeId(e.target.value)}>
              <option value="">Select resume…</option>
              {resumes.map((r: any) => (
                <option key={r.id} value={r.id}>{r.file_name}</option>
              ))}
            </select>
            <Button onClick={onCreate} disabled={!url || !resumeId || creating}>Create & Run</Button>
            {createdId && <div>Created job: <a className="underline" href={`/jobs/${createdId}`}>{createdId}</a></div>}
            {error && <div className="text-red-600">{error}</div>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


