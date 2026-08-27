import { useState, type ReactNode } from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BasicsForm } from "@/editor/sections/BasicsForm"
import { WorkForm } from "@/editor/sections/WorkForm"
import { EducationForm } from "@/editor/sections/EducationForm"
import { SkillsForm } from "@/editor/sections/SkillsForm"
import {
  CertificatesForm,
  InterestsForm,
  LanguagesForm,
  ProjectsForm,
  VolunteerForm,
} from "@/editor/sections/SimpleForms"

interface Tab {
  id: string
  label: string
  render: () => ReactNode
}

const TABS: Tab[] = [
  { id: "basics", label: "Basics", render: () => <BasicsForm /> },
  { id: "work", label: "Work", render: () => <WorkForm /> },
  { id: "education", label: "Education", render: () => <EducationForm /> },
  { id: "skills", label: "Skills", render: () => <SkillsForm /> },
  { id: "interests", label: "Interests", render: () => <InterestsForm /> },
  { id: "volunteer", label: "Volunteer", render: () => <VolunteerForm /> },
  { id: "projects", label: "Projects", render: () => <ProjectsForm /> },
  {
    id: "certificates",
    label: "Certificates",
    render: () => <CertificatesForm />,
  },
  { id: "languages", label: "Languages", render: () => <LanguagesForm /> },
]

export function EditorPane() {
  const [active, setActive] = useState("basics")

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        value={active}
        onValueChange={setActive}
        className="shrink-0 border-b p-2"
      >
        <TabsList className="h-auto flex-wrap">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ScrollArea className="min-h-0 flex-1">
        <div>
          {TABS.map((tab) => (
            <div key={tab.id} hidden={active !== tab.id}>
              {tab.render()}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
