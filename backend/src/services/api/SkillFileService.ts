import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { AppError } from '../../domain/errors.js';
import type { LocalStore } from '../LocalStore.js';
import { LogService } from '../LogService.js';
import type { ServiceContext } from '../ServiceContext.js';

export class SkillFileService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async deleteSkill(id: string) {
    const skill = await this.store.getSkill(id);
    if (skill && skill.isBuiltin) {
      throw new AppError(403, '系统内置技能不可删除');
    }

    const skillsDir = this.store.getSkillsDir();
    const skillDir = (skill && skill.dirPath) || path.join(skillsDir, id);
    if (fs.existsSync(skillDir) && skillDir.startsWith(skillsDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }

    await this.store.deleteSkill(id);
    await this.context.skillService.refreshSkills();
    return { status: 'success' };
  }

  async listFiles(id: string) {
    const skill = await this.getRequiredSkill(id);
    const skillDir = this.resolveSkillDir(skill);
    if (!fs.existsSync(skillDir)) {
      return { files: [] };
    }
    return { files: this.walkDir(skillDir) };
  }

  async readFile(id: string, filePath: string) {
    const skill = await this.getRequiredSkill(id);
    const skillDir = this.resolveSkillDir(skill);
    const fullPath = this.resolveSafePath(skillDir, filePath);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      throw new AppError(404, '文件不存在');
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return { content, path: filePath };
  }

  async writeFile(id: string, filePath: string, content: string) {
    const skill = await this.getRequiredSkill(id);
    const skillDir = this.resolveSkillDir(skill);
    const fullPath = this.resolveSafePath(skillDir, filePath);
    const targetDir = path.dirname(fullPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');

    let needsDbSave = false;
    if (!skill.files) skill.files = [];
    if (filePath !== 'SKILL.md' && !skill.files.includes(filePath)) {
      skill.files.push(filePath);
      needsDbSave = true;
    }

    if (filePath === 'SKILL.md') {
      needsDbSave = this.syncSkillMarkdownMetadata(skill, content) || needsDbSave;
    }

    if (needsDbSave) {
      await this.store.saveSkill(skill);
    }
    await this.context.skillService.refreshSkills();

    return { status: 'success' };
  }

  private async getRequiredSkill(id: string) {
    const skill = await this.store.getSkill(id);
    if (!skill) {
      throw new AppError(404, '技能不存在');
    }
    return skill;
  }

  private resolveSkillDir(skill: any): string {
    if (skill.dirPath && fs.existsSync(skill.dirPath)) {
      return skill.dirPath;
    }

    const fsSkill = this.context.skillService.getSkill(skill.id);
    if (fsSkill?.dirPath && fs.existsSync(fsSkill.dirPath)) {
      return fsSkill.dirPath;
    }

    return skill.dirPath || path.join(this.store.getSkillsDir(), skill.id);
  }

  private resolveSafePath(skillDir: string, filePath: string) {
    const fullPath = path.resolve(skillDir, filePath);
    const root = path.resolve(skillDir);
    if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
      throw new AppError(403, 'Forbidden');
    }
    return fullPath;
  }

  private walkDir(dir: string, prefix = ''): any[] {
    const items: any[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: rel,
          type: 'dir',
          children: this.walkDir(path.join(dir, entry.name), rel)
        });
      } else {
        const stat = fs.statSync(path.join(dir, entry.name));
        items.push({ name: entry.name, path: rel, type: 'file', size: stat.size });
      }
    }
    return items;
  }

  private syncSkillMarkdownMetadata(skill: any, content: string) {
    const skillMdContent = content
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const frontmatterMatch = skillMdContent.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n?([\s\S]*)$/);
    if (!frontmatterMatch) {
      return false;
    }

    try {
      const metadata = YAML.parse(frontmatterMatch[1]);
      const instructions = frontmatterMatch[2].trim();
      let changed = false;
      if (metadata.name) {
        skill.name = metadata.name;
        changed = true;
      }
      if (metadata.description) {
        skill.description = metadata.description;
        changed = true;
      }
      if (instructions !== undefined) {
        skill.instructions = instructions;
        changed = true;
      }
      return changed;
    } catch (error: any) {
      LogService.warn(`Failed to parse SKILL.md YAML: ${error.message}`);
      return false;
    }
  }
}
