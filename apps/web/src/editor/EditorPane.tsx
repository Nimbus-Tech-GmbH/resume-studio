import { useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { BasicsForm } from './sections/BasicsForm.js';
import { WorkForm } from './sections/WorkForm.js';
import { EducationForm } from './sections/EducationForm.js';
import { SkillsForm } from './sections/SkillsForm.js';
import {
  CertificatesForm,
  InterestsForm,
  LanguagesForm,
  ProjectsForm,
  VolunteerForm,
} from './sections/SimpleForms.js';

interface Tab {
  id: string;
  label: string;
  render: () => ReactNode;
}

const TABS: Tab[] = [
  { id: 'basics', label: 'Basics', render: () => <BasicsForm /> },
  { id: 'work', label: 'Work', render: () => <WorkForm /> },
  { id: 'education', label: 'Education', render: () => <EducationForm /> },
  { id: 'skills', label: 'Skills', render: () => <SkillsForm /> },
  { id: 'interests', label: 'Interests', render: () => <InterestsForm /> },
  { id: 'volunteer', label: 'Volunteer', render: () => <VolunteerForm /> },
  { id: 'projects', label: 'Projects', render: () => <ProjectsForm /> },
  { id: 'certificates', label: 'Certificates', render: () => <CertificatesForm /> },
  { id: 'languages', label: 'Languages', render: () => <LanguagesForm /> },
];

export function EditorPane() {
  const [active, setActive] = useState<string>('basics');
  const activeTab = TABS.find((t) => t.id === active) ?? TABS[0]!;

  return (
    <div className="flex h-full flex-col">
      <Tabs value={active} onValueChange={setActive} className="flex-1 overflow-hidden">
        <div className="flex h-10 shrink-0 items-center border-b bg-card px-2">
          <TabsList className="h-7 p-0.5">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="h-6 px-2">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0">
              {tab.render()}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
