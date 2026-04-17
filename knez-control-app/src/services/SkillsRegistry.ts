import { BaseDirectory, readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs'
import { logger } from './LogService'

type SkillMeta = {
  name: string
  description: string
  tags?: string[]
  version?: string
  path: string
  content: string
}

class SkillsRegistry {
  private skills: SkillMeta[] = []
  private baseDir = '.taqwin/skills'

  async load(): Promise<void> {
    try {
      const indexPath = `${this.baseDir}/index.json`
      const hasIndex = await exists(indexPath, { baseDir: BaseDirectory.AppLocalData }).catch(() => false)
      if (!hasIndex) {
        this.skills = []
        return
      }
      const rawIndex = await readTextFile(indexPath, { baseDir: BaseDirectory.AppLocalData })
      let names: string[] = []
      try {
        names = JSON.parse(rawIndex)
      } catch (e) {
        logger.warn('skills_registry', 'parse_index_failed', { error: String(e) })
        names = []
      }
      const loaded: SkillMeta[] = []
      for (const name of names) {
        const skillPath = `${this.baseDir}/${name}/SKILL.md`
        const md = await readTextFile(skillPath, { baseDir: BaseDirectory.AppLocalData }).catch(() => '')
        if (!md) continue
        const meta = this.parseFrontmatter(md)
        loaded.push({
          name: meta.name || name,
          description: meta.description || '',
          tags: meta.tags || [],
          version: meta.version || '1.0.0',
          path: skillPath,
          content: md,
        })
      }
      this.skills = loaded
    } catch (e) {
      logger.warn('skills_registry', 'load_failed', { error: String(e) });
      this.skills = []
    }
  }

  getSkills(): SkillMeta[] {
    return this.skills
  }

  async appendLearning(skillName: string, entry: string): Promise<void> {
    try {
      const skill = this.skills.find(s => s.name === skillName || s.path.endsWith(`/${skillName}/SKILL.md`))
      if (!skill) return
      const timestamp = new Date().toISOString()
      const updated = this.ensureLearningsSection(skill.content) + `\n- [${timestamp}] ${entry}\n`
      await writeTextFile(skill.path, updated, { baseDir: BaseDirectory.AppLocalData })
      await this.load()
    } catch (e) {
      logger.error('skills_registry', 'append_learning_failed', { skillName, error: String(e) });
    }
  }

  private parseFrontmatter(md: string): Record<string, any> {
    const lines = md.split('\n')
    if (lines[0].trim() !== '---') return {}
    const meta: Record<string, any> = {}
    let i = 1
    while (i < lines.length && lines[i].trim() !== '---') {
      const line = lines[i]
      const idx = line.indexOf(':')
      if (idx > -1) {
        const key = line.slice(0, idx).trim()
        const valRaw = line.slice(idx + 1).trim()
        const val = valRaw.replace(/^"(.*)"$/, '$1')
        if (key === 'tags') {
          meta[key] = val.split(',').map(s => s.trim()).filter(Boolean)
        } else {
          meta[key] = val
        }
      }
      i++
    }
    return meta
  }

  private ensureLearningsSection(md: string): string {
    if (md.includes('\n## Learnings')) return md
    return md + '\n\n## Learnings\n'
  }

  async ensureBase(): Promise<void> {
    const hasDir = await exists(this.baseDir, { baseDir: BaseDirectory.AppLocalData }).catch(() => false)
    if (!hasDir) {
      await mkdir(this.baseDir, { baseDir: BaseDirectory.AppLocalData, recursive: true })
      await writeTextFile(`${this.baseDir}/index.json`, JSON.stringify([], null, 2), { baseDir: BaseDirectory.AppLocalData })
    }
  }
}

export const skillsRegistry = new SkillsRegistry()
