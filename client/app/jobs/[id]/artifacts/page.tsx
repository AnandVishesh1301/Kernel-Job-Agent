import { api } from '../../../../lib/api';

type Artifact = { id: string; type: string; r2_key: string; created_at: string };

function r2PublicUrl(key: string) {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  return null;
}

export default async function ArtifactsPage({ params }: { params: { id: string } }) {
  const items = await api<Artifact[]>(`/jobs/${params.id}/artifacts`);
  return (
    <div>
      <h1>Artifacts for Job {params.id}</h1>
      {items.length === 0 ? (
        <div>No artifacts yet.</div>
      ) : (
        <ul>
          {items.map(a => {
            const pub = r2PublicUrl(a.r2_key);
            return (
              <li key={a.id}>
                {a.type} – {a.r2_key} {pub ? (<a href={pub} target="_blank" rel="noreferrer">Open</a>) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


