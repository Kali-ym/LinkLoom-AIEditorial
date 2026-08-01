import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import yaml from 'yaml';
import { AppError } from '../../domain/errors.js';
import { SkillContent, SkillEntry, SkillFrontmatter, SkillMetadata } from '../../types/skill.js';
import { LogService } from '../LogService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SkillService {
  private skills: Map<string, SkillEntry> = new Map();
  private searchPaths: string[];

  constructor(searchPaths?: string[]) {
    this.searchPaths = searchPaths || [
      path.join(process.cwd(), 'backend', 'skills'),
      path.join(process.cwd(), '.agents', 'skills'),
      path.join(process.cwd(), 'data', 'skills'),
      path.join(__dirname, '..', '..', '..', 'skills'),
      path.join(__dirname, '..', '..', '..', 'dist', 'skills')
    ];
  }

  async init() {
    await this.refreshSkills();
  }

  async refreshSkills() {
    this.skills.clear();

    // Reverse search paths to respect priority (higher priority paths loaded last to overwrite)
    const pathsToSearch = [...this.searchPaths].reverse();

    for (const searchPath of pathsToSearch) {
      if (!(await fs.pathExists(searchPath))) continue;

      const entries = await fs.readdir(searchPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(searchPath, entry.name, 'SKILL.md');
          if (await fs.pathExists(skillPath)) {
            try {
              const skill = await this.parseSkillFile(skillPath);
              this.skills.set(skill.id, skill);
              LogService.info(`Loaded skill: ${skill.name} (${skill.id}) from ${searchPath}`);
            } catch (error) {
              LogService.error(`Failed to parse skill at ${skillPath}: ${error}`);
            }
          }
        }
      }
    }
  }

  private async listSkillFiles(dirPath: string, currentDir = dirPath): Promise<string[]> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.listSkillFiles(dirPath, fullPath)));
        continue;
      }

      const relativePath = path.relative(dirPath, fullPath).replace(/\\/g, '/');
      if (relativePath !== 'SKILL.md') {
        files.push(relativePath);
      }
    }

    return files.sort((a, b) => a.localeCompare(b));
  }

  private async parseSkillFile(filePath: string): Promise<SkillEntry> {
    const content = await fs.readFile(filePath, 'utf-8');
    const dirPath = path.dirname(filePath);
    const id = path.basename(dirPath);

    const builtinRoots = [
      path.join(process.cwd(), 'backend', 'skills'),
      path.join(__dirname, '..', '..', '..', 'skills'),
      path.join(__dirname, '..', '..', '..', 'dist', 'skills')
    ];
    const isBuiltin = builtinRoots.some(
      (root) => dirPath.startsWith(root + path.sep) || dirPath === root
    );

    // Parse Frontmatter
    const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n([\s\S]*)$/);
    if (!match) {
      throw new Error('Invalid Skill format: Missing Frontmatter');
    }

    const frontmatterRaw = match[1];
    const instructions = match[2].trim();
    const frontmatter = yaml.parse(frontmatterRaw) as SkillFrontmatter;

    return {
      id,
      name: frontmatter.name || id,
      description: frontmatter.description || '',
      instructions,
      files: await this.listSkillFiles(dirPath),
      frontmatter,
      dirPath,
      fullPath: filePath,
      isBuiltin
    };
  }

  getSkill(id: string): SkillEntry | undefined {
    return this.skills.get(id);
  }

  listSkills(): SkillEntry[] {
    return Array.from(this.skills.values());
  }

  listSkillMetadata(skillIds?: string[]): SkillMetadata[] {
    const ids = skillIds ?? Array.from(this.skills.keys()).sort((a, b) => a.localeCompare(b));
    const metadata: SkillMetadata[] = [];

    for (const id of ids) {
      const skill = this.getSkill(id);
      if (!skill) continue;
      if (!this.checkDependencies(skill)) {
        LogService.warn(`Skipping skill ${skill.name} due to missing dependencies.`);
        continue;
      }
      metadata.push({
        id: skill.id,
        name: skill.name,
        description: skill.description,
      });
    }

    return metadata;
  }

  async readSkillContent(skillId: string, relativePath = 'SKILL.md'): Promise<SkillContent> {
    const skill = this.getSkill(skillId);
    if (!skill) throw new AppError(404, `Skill not found: ${skillId}`);
    const normalized = relativePath.replace(/\\/g, '/');
    const fullPath = resolveSafePath(skill.dirPath, normalized);
    if (!(await fs.pathExists(fullPath)) || (await fs.stat(fullPath)).isDirectory()) {
      throw new AppError(404, `Skill file not found: ${normalized}`);
    }
    return {
      skillId: skill.id,
      name: skill.name,
      description: skill.description,
      path: normalized,
      content: await fs.readFile(fullPath, 'utf8'),
      ...(normalized === 'SKILL.md' ? { files: [...skill.files] } : {}),
    };
  }

  private checkDependencies(skill: SkillEntry): boolean {
    if (!skill.frontmatter.bins || skill.frontmatter.bins.length === 0) {
      return true;
    }

    for (const bin of skill.frontmatter.bins) {
      try {
        // Simple check using 'where' on Windows or 'which' on others
        const cmd = process.platform === 'win32' ? `where ${bin}` : `which ${bin}`;
        execSync(cmd, { stdio: 'ignore' });
      } catch (e) {
        LogService.error(`Dependency missing for skill ${skill.name}: ${bin}`);
        return false;
      }
    }

    return true;
  }
}

function resolveSafePath(skillDir: string, filePath: string): string {
  const fullPath = path.resolve(skillDir, filePath);
  const root = path.resolve(skillDir);
  if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
    throw new AppError(403, 'Forbidden');
  }
  return fullPath;
}
