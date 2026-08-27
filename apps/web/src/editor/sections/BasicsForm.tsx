import { useState } from "react"
import { Image as ImageIcon } from "lucide-react"

import { useEditorStore } from "@/state/editorStore"
import { TextAreaField, TextField } from "@/editor/fields/Fields"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export function BasicsForm() {
  const basics = useEditorStore((state) => state.resume.basics) ?? {}
  const patchResume = useEditorStore((state) => state.patchResume)

  const set = <K extends keyof typeof basics>(key: K, value: string) =>
    patchResume((resume) => ({
      ...resume,
      basics: {
        ...resume.basics,
        [key]: value,
      },
    }))

  const setLocation = (key: string, value: string) =>
    patchResume((resume) => ({
      ...resume,
      basics: {
        ...resume.basics,
        location: {
          ...resume.basics?.location,
          [key]: value,
        },
      },
    }))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              value={basics.name}
              onChange={(value) => set("name", value)}
            />

            <TextField
              label="Label"
              value={basics.label}
              onChange={(value) => set("label", value)}
            />

            <TextField
              label="Email"
              type="email"
              value={basics.email}
              onChange={(value) => set("email", value)}
            />

            <TextField
              label="Phone"
              value={basics.phone}
              onChange={(value) => set("phone", value)}
            />

            <TextField
              label="URL"
              type="url"
              value={basics.url}
              onChange={(value) => set("url", value)}
            />

            <TextField
              label="Image URL"
              type="url"
              value={basics.image}
              placeholder="https://…/photo.jpg"
              onChange={(value) => set("image", value)}
            />

            <ImagePreview url={basics.image} />
          </div>

          <TextAreaField
            label="Summary"
            value={basics.summary}
            onChange={(value) => set("summary", value)}
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="City"
              value={basics.location?.city}
              onChange={(value) => setLocation("city", value)}
            />

            <TextField
              label="Region"
              value={basics.location?.region}
              onChange={(value) => setLocation("region", value)}
            />

            <TextField
              label="Country code"
              value={basics.location?.countryCode}
              onChange={(value) => setLocation("countryCode", value)}
            />

            <TextField
              label="Postal code"
              value={basics.location?.postalCode}
              onChange={(value) => setLocation("postalCode", value)}
            />

            <TextField
              label="Address"
              value={basics.location?.address}
              onChange={(value) => setLocation("address", value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ImagePreview({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false)
  const src = url?.trim()
  const [seenSrc, setSeenSrc] = useState(src)

  if (src !== seenSrc) {
    setSeenSrc(src)
    setFailed(false)
  }

  return (
    <div className="space-y-2">
      <Label>Preview</Label>

      {src && !failed ? (
        <img
          src={src}
          alt="Profile preview"
          onError={() => setFailed(true)}
          className="size-20 border object-cover"
        />
      ) : (
        <div className="flex size-20 items-center justify-center border border-dashed">
          <ImageIcon />
        </div>
      )}
    </div>
  )
}
