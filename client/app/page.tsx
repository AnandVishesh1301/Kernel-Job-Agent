import { api } from '../lib/api';
import { Badge, Button, Card, CardBody, CardHeader } from '../components/ui';

type Job = {
  id: string;
  target_url: string;
  status: 'queued'|'running'|'succeeded'|'failed';
  live_view_url?: string | null;
  created_at: string;
};

function domainOf(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

export default async function Page() {
  const jobs = await api<Job[]>('/jobs');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">Jobs</h1>
        <div className="space-x-2">
          <a href="/upload"><Button variant="outline">Upload Resume</Button></a>
          <a href="/preferences"><Button>Questions / Preferences</Button></a>
        </div>
      </div>
      <Card>
        <CardHeader>Recent</CardHeader>
        <CardBody>
          {jobs.length === 0 ? (
            <div className="text-sm text-gray-500">No jobs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">ID</th>
                    <th className="py-2">Domain</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id} className="border-t">
                      <td className="py-2"><a className="underline" href={`/jobs/${j.id}`}>{j.id.slice(0,8)}…</a></td>
                      <td className="py-2">{domainOf(j.target_url)}</td>
                      <td className="py-2">
                        <Badge color={j.status === 'succeeded' ? 'green' : j.status === 'failed' ? 'red' : j.status === 'running' ? 'yellow' : 'gray'}>
                          {j.status}
                        </Badge>
                      </td>
                      <td className="py-2 space-x-3">
                        {j.live_view_url ? (
                          <>
                            <a className="underline" href={`${j.live_view_url}?readOnly=true`} target="_blank" rel="noreferrer">Live View</a>
                            <a className="underline" href={j.live_view_url} target="_blank" rel="noreferrer">Interactive</a>
                          </>
                        ) : (
                          <span className="text-gray-400">No live view</span>
                        )}
                        <a className="underline" href={`/jobs/${j.id}/artifacts`}>Artifacts</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


