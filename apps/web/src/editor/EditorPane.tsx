import { useState, type ComponentType } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  component: ComponentType
}

const TABS: [Tab, ...Tab[]] = [
  { id: "basics", label: "Basics", component: BasicsForm },
  { id: "work", label: "Work", component: WorkForm },
  { id: "education", label: "Education", component: EducationForm },
  { id: "skills", label: "Skills", component: SkillsForm },
  { id: "interests", label: "Interests", component: InterestsForm },
  { id: "volunteer", label: "Volunteer", component: VolunteerForm },
  { id: "projects", label: "Projects", component: ProjectsForm },
  { id: "certificates", label: "Certificates", component: CertificatesForm },
  { id: "languages", label: "Languages", component: LanguagesForm },
]

export function EditorPane() {
  const [active, setActive] = useState(TABS[0].id)

  return (
    <Tabs value={active} onValueChange={setActive} className="flex h-full min-h-0 flex-col">
      <div className="relative shrink-0 border-b">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto px-2 [&>div]:flex-none">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-0">
            <tab.component />
          </TabsContent>
        ))}
      </ScrollArea>
    </Tabs>
  )
}
