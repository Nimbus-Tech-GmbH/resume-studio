import { useEditorStore } from '../../state/editorStore.js';
import { TextAreaField, TextField } from '../fields/Fields.js';

export function BasicsForm() {
  const basics = useEditorStore((s) => s.resume.basics) ?? {};
  const patch = useEditorStore((s) => s.patchResume);

  const set = <K extends keyof typeof basics>(key: K, val: string) =>
    patch((r) => ({ ...r, basics: { ...r.basics, [key]: val } }));

  const setLocation = (key: string, val: string) =>
    patch((r) => ({
      ...r,
      basics: { ...r.basics, location: { ...r.basics?.location, [key]: val } },
    }));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Name" value={basics.name} onChange={(v) => set('name', v)} />
        <TextField label="Label" value={basics.label} onChange={(v) => set('label', v)} />
        <TextField
          label="Email"
          type="email"
          value={basics.email}
          onChange={(v) => set('email', v)}
        />
        <TextField label="Phone" value={basics.phone} onChange={(v) => set('phone', v)} />
        <TextField label="URL" type="url" value={basics.url} onChange={(v) => set('url', v)} />
      </div>
      <TextAreaField
        label="Summary"
        value={basics.summary}
        onChange={(v) => set('summary', v)}
        rows={4}
      />
      <fieldset className="grid grid-cols-2 gap-3 rounded border border-neutral-200 p-3">
        <legend className="px-1 text-xs font-medium text-neutral-500">Location</legend>
        <TextField
          label="City"
          value={basics.location?.city}
          onChange={(v) => setLocation('city', v)}
        />
        <TextField
          label="Region"
          value={basics.location?.region}
          onChange={(v) => setLocation('region', v)}
        />
        <TextField
          label="Country code"
          value={basics.location?.countryCode}
          onChange={(v) => setLocation('countryCode', v)}
        />
        <TextField
          label="Postal code"
          value={basics.location?.postalCode}
          onChange={(v) => setLocation('postalCode', v)}
        />
        <TextField
          label="Address"
          value={basics.location?.address}
          onChange={(v) => setLocation('address', v)}
        />
      </fieldset>
    </div>
  );
}
