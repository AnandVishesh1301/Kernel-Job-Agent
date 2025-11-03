import { api } from '../../../lib/api';
import { Badge, Card, CardBody, CardHeader } from '../../../components/ui';

type Job = {
  id: string;
  target_url: string;
  status: string;
  live_view_url?: string | null;
  result_summary?: string | null;
  error?: string | null;
};

export default async function JobDetail({ params }: { params: { id: string } }) {
  const job = await api<Job>(`/jobs/${params.id}`);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>Job {job.id}</CardHeader>
        <CardBody className="space-y-2">
          <div className="flex items-center gap-3">
            <span>Status</span>
            <Badge color={job.status === 'succeeded' ? 'green' : job.status === 'failed' ? 'red' : job.status === 'running' ? 'yellow' : 'gray'}>
              {job.status}
            </Badge>
          </div>
          {job.result_summary ? <p>Summary: {job.result_summary}</p> : null}
          {job.error ? <p className="text-red-600">Error: {job.error}</p> : null}
          <div className="space-x-4">
            {job.live_view_url ? (
              <>
                <a className="underline" href={`${job.live_view_url}?readOnly=true`} target="_blank" rel="noreferrer">Open Live View</a>
                <a className="underline" href={job.live_view_url} target="_blank" rel="noreferrer">Open Interactive</a>
              </>
            ) : (
              <span className="text-gray-400">No live view</span>
            )}
            <a className="underline" href={`/jobs/${job.id}/artifacts`}>View Artifacts</a>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


