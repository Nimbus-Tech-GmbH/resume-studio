import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
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
      <nav className="flex flex-wrap gap-1 border-b border-neutral-200 bg-white px-3 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={clsx(
              'rounded px-2 py-1 text-xs',
              active === tab.id
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto p-4">{activeTab.render()}</div>
    </div>
  );
}
