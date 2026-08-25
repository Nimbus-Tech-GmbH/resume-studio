import { useState, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { ScrollArea } from '../components/ui/scroll-area.js';
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

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b bg-card px-4 py-3">
        <Tabs value={active} onValueChange={setActive} className="w-full">
          <TabsList className="h-9 w-full justify-start gap-1 bg-transparent p-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-7 rounded-md px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-6">
          {TABS.map((tab) => (
            <div key={tab.id} className={active === tab.id ? 'block' : 'hidden'}>
              {tab.render()}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
