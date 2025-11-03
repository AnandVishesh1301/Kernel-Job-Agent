'use client';
import { useState } from 'react';
import { uploadFile, api } from '../../lib/api';
import { Button, Card, CardBody, CardHeader } from '../../components/ui';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [resume, setResume] = useState<any>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload() {
    setError(null);
    if (!file) return;
    try {
      const res = await uploadFile('/resumes', file);
      setResume(res);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    }
  }

  async function onParse() {
    if (!resume) return;
    setParsing(true);
    setError(null);
    try {
      const parsed = await api(`/resumes/${resume.id}/parse`, { method: 'POST' });
      setResume(parsed);
    } catch (e: any) {
      setError(e.message || 'Parse failed');
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>Upload Resume</CardHeader>
        <CardBody className="space-y-3">
          <input className="block" type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          <Button onClick={onUpload} disabled={!file}>Upload</Button>
          {error && <p className="text-red-600">{error}</p>}
          {resume && (
            <div className="space-y-2">
              <div>Uploaded: {resume.file_name}</div>
              <Button onClick={onParse} disabled={parsing}>Parse Resume</Button>
              {resume.parsed_profile && (
                <pre className="bg-gray-50 p-3 rounded border text-xs overflow-auto">{JSON.stringify(resume.parsed_profile, null, 2)}</pre>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


