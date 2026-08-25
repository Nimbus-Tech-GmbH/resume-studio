import { useState } from 'react';
import { useEditorStore } from '../../state/editorStore.js';
import { TextField, TextAreaField } from '../fields/Fields.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.js';
import { Label } from '../../components/ui/label.js';
import { Image as ImageIcon } from 'lucide-react';

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
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
            <TextField
              label="Image URL"
              type="url"
              value={basics.image}
              placeholder="https://…/photo.jpg"
              onChange={(v) => set('image', v)}
            />
            <ImagePreview url={basics.image} />
          </div>
          <TextAreaField
            label="Summary"
            value={basics.summary}
            onChange={(v) => set('summary', v)}
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ImagePreview({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);
  const src = url?.trim();
  const [seenSrc, setSeenSrc] = useState(src);

  // Reset the error flag whenever the URL changes (derived-state pattern).
  if (src !== seenSrc) {
    setSeenSrc(src);
    setFailed(false);
  }

  return (
    <div className="space-y-1.5">
      <Label>Preview</Label>
      {src && !failed ? (
        <img
          src={src}
          alt="Profile preview"
          onError={() => setFailed(true)}
          className="h-20 w-20 rounded-md border object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed text-muted-foreground">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}
