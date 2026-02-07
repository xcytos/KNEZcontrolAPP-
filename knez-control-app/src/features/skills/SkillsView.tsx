import React, { useEffect, useState } from 'react'
import { skillsRegistry } from '../../services/SkillsRegistry'

export const SkillsView: React.FC = () => {
  const [skills, setSkills] = useState(() => skillsRegistry.getSkills())
  useEffect(() => {
    skillsRegistry.load().then(() => setSkills(skillsRegistry.getSkills()))
  }, [])
  return (
    <div className="p-6">
      <div className="mb-4 border-b border-zinc-800 pb-2">
        <h2 className="text-lg font-bold text-zinc-100">Skills</h2>
        <p className="text-xs text-zinc-500">Loaded from .taqwin/skills</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {skills.map(s => (
          <div key={s.name} className="bg-zinc-900 border border-zinc-800 rounded p-4">
            <div className="text-zinc-200 font-medium">{s.name}</div>
            <div className="text-xs text-zinc-500">{s.description}</div>
            <div className="mt-2 text-[10px] text-zinc-600">tags: {(s.tags||[]).join(', ')}</div>
          </div>
        ))}
        {skills.length === 0 && (
          <div className="text-zinc-600 text-sm">No skills loaded.</div>
        )}
      </div>
    </div>
  )
}
