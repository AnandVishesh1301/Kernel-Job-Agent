'use client';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button, Card, CardBody, CardHeader } from '../../components/ui';

export default function PreferencesPage() {
  const [data, setData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api('/preferences').then((r: any) => setData(r.data ?? r)).catch(() => setData({}));
  }, []);

  async function onSave() {
    setSaving(true); setError(null); setOk(false);
    try {
      await api('/preferences', { method: 'PUT', body: JSON.stringify({ data }) });
      setOk(true);
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>Questions / Preferences</CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-gray-600">These answers will be used to fill standard application questions.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Gender</label>
              <select className="border rounded px-3 py-2 w-full" value={data.gender ?? ''} onChange={e => setData({ ...data, gender: e.target.value })}>
                <option value="">Select…</option>
                <option>Male</option>
                <option>Female</option>
                <option>Non-binary</option>
                <option>Prefer to self-describe</option>
                <option>Prefer not to answer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Race / Ethnicity</label>
              <select className="border rounded px-3 py-2 w-full" value={data.race_ethnicity ?? ''} onChange={e => setData({ ...data, race_ethnicity: e.target.value })}>
                <option value="">Select…</option>
                <option>Hispanic or Latino</option>
                <option>White (Not Hispanic or Latino)</option>
                <option>Black or African American (Not Hispanic or Latino)</option>
                <option>Native Hawaiian or Other Pacific Islander (Not Hispanic or Latino)</option>
                <option>Asian (Not Hispanic or Latino)</option>
                <option>American Indian or Alaska Native (Not Hispanic or Latino)</option>
                <option>Two or More Races (Not Hispanic or Latino)</option>
                <option>Prefer not to answer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Veteran Status</label>
              <select className="border rounded px-3 py-2 w-full" value={data.veteran_status ?? ''} onChange={e => setData({ ...data, veteran_status: e.target.value })}>
                <option value="">Select…</option>
                <option>Yes, I am a protected veteran</option>
                <option>No, I am not a protected veteran</option>
                <option>I don't wish to answer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Veteran Type</label>
              <input className="border rounded px-3 py-2 w-full" value={data.veteran_type ?? ''} onChange={e => setData({ ...data, veteran_type: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm mb-1">Disability Status</label>
              <select className="border rounded px-3 py-2 w-full" value={data.disability_status ?? ''} onChange={e => setData({ ...data, disability_status: e.target.value })}>
                <option value="">Select…</option>
                <option>Yes, I have a disability (or previously had a disability)</option>
                <option>No, I do not have a disability</option>
                <option>I don't wish to answer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Authorized to work in the U.S.?</label>
              <select className="border rounded px-3 py-2 w-full" value={data.work_authorization ?? ''} onChange={e => setData({ ...data, work_authorization: e.target.value })}>
                <option value="">Select…</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Visa sponsorship required now or in future?</label>
              <select className="border rounded px-3 py-2 w-full" value={data.visa_sponsorship_required ?? ''} onChange={e => setData({ ...data, visa_sponsorship_required: e.target.value })}>
                <option value="">Select…</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Citizenship</label>
              <select className="border rounded px-3 py-2 w-full" value={data.us_citizenship ?? ''} onChange={e => setData({ ...data, us_citizenship: e.target.value })}>
                <option value="">Select…</option>
                <option>U.S. Citizen</option>
                <option>U.S. Permanent Resident (Green Card Holder)</option>
                <option>Authorized to work for any employer</option>
                <option>Authorized to work for current employer</option>
                <option>Not authorized to work in the U.S.</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Are you 18 or older?</label>
              <select className="border rounded px-3 py-2 w-full" value={data.age_18_plus ?? ''} onChange={e => setData({ ...data, age_18_plus: e.target.value })}>
                <option value="">Select…</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Criminal History (felony conviction)</label>
              <select className="border rounded px-3 py-2 w-full" value={data.has_criminal_history ?? ''} onChange={e => setData({ ...data, has_criminal_history: e.target.value })}>
                <option value="">Select…</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Earliest Start Date</label>
              <input type="date" className="border rounded px-3 py-2 w-full" value={data.earliest_start_date ?? ''} onChange={e => setData({ ...data, earliest_start_date: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm mb-1">Desired Salary Min</label>
              <input type="number" className="border rounded px-3 py-2 w-full" value={data.desired_salary_min ?? ''} onChange={e => setData({ ...data, desired_salary_min: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Desired Salary Max</label>
              <input type="number" className="border rounded px-3 py-2 w-full" value={data.desired_salary_max ?? ''} onChange={e => setData({ ...data, desired_salary_max: Number(e.target.value) })} />
            </div>

            <div>
              <label className="block text-sm mb-1">Willing to Travel</label>
              <select className="border rounded px-3 py-2 w-full" value={data.willing_to_travel ?? ''} onChange={e => setData({ ...data, willing_to_travel: e.target.value })}>
                <option value="">Select…</option>
                <option>Yes, up to 25%</option>
                <option>Yes, up to 50%</option>
                <option>Yes, up to 75%</option>
                <option>Yes, up to 100%</option>
                <option>No</option>
              </select>
            </div>
          </div>

          <div>
            <Button onClick={() => {
              // normalize boolean-like strings to booleans where applicable
              const normalized: any = { ...data };
              ['work_authorization','visa_sponsorship_required','has_criminal_history'].forEach(k => {
                if (normalized[k] === 'true') normalized[k] = true;
                if (normalized[k] === 'false') normalized[k] = false;
              });
              setData(normalized);
              onSave();
            }} disabled={saving}>Save</Button>
            {ok && <span className="ml-2 text-green-600">Saved</span>}
            {error && <span className="ml-2 text-red-600">{error}</span>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


