import fs from 'fs';
import path from 'path';
import type { MultipartFile } from '@fastify/multipart';
import AdmZip from 'adm-zip';
import YAML from 'yaml';
import { AppError } from '../../domain/errors.js';
import type { LocalStore } from '../LocalStore.js';
import type { ServiceContext } from '../ServiceContext.js';

const FRONTMATTER_RE = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n?([\s\S]*)$/;

export class SkillImportService {
  constructor(
    private readonly store: LocalStore,
    private readonly context: ServiceContext
  ) {}

  async importFromZip(data: MultipartFile | undefined) {
    if (!data) {
      throw new AppError(400, '请上传 .zip 压缩包');
    }

    const buffer = await data.toBuffer();
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    let skillMdEntry = entries.find((entry) => entry.entryName === 'SKILL.md');
    if (!skillMdEntry) {
      skillMdEntry = entries.find(
        (entry) => entry.entryName.endsWith('/SKILL.md') && entry.entryName.split('/').length === 2
      );
    }
    if (!skillMdEntry) {
      throw new AppError(400, '压缩包中未找到 SKILL.md 文件');
    }

    const skillMdContent = normalizeSkillMarkdown(skillMdEntry.getData().toString('utf8'));
    const frontmatterMatch = skillMdContent.match(FRONTMATTER_RE);
    if (!frontmatterMatch) {
      throw new AppError(400, 'SKILL.md 缺少 YAML frontmatter（需要 --- 包裹的元数据）');
    }

    let metadata: any;
    try {
      metadata = YAML.parse(frontmatterMatch[1]);
    } catch (yamlErr: any) {
      throw new AppError(400, `SKILL.md frontmatter YAML 格式错误: ${yamlErr.message}`);
    }

    if (!metadata.name) {
      throw new AppError(400, 'SKILL.md frontmatter 缺少 name 字段');
    }
    if (!metadata.description) {
      throw new AppError(400, 'SKILL.md frontmatter 缺少 description 字段');
    }
    if (metadata.name.length > 64 || !/^[a-z0-9-]+$/.test(metadata.name)) {
      throw new AppError(400, 'name 仅允许小写字母、数字和连字符，最多64字符');
    }

    const instructions = frontmatterMatch[2].trim();
    const skillId = metadata.name;
    const skillsDir = this.store.getSkillsDir();
    const skillDir = path.join(skillsDir, skillId);

    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }
    fs.mkdirSync(skillDir, { recursive: true });

    const prefix =
      skillMdEntry.entryName === 'SKILL.md' ? '' : skillMdEntry.entryName.replace('SKILL.md', '');
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const relativePath = prefix ? entry.entryName.replace(prefix, '') : entry.entryName;
      const targetPath = path.join(skillDir, relativePath);
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, entry.getData());
      if (relativePath !== 'SKILL.md') {
        files.push(relativePath);
      }
    }

    const skill = {
      id: skillId,
      name: metadata.name,
      description: metadata.description,
      instructions,
      files,
      dirPath: skillDir
    };

    await this.store.saveSkill(skill);
    await this.context.skillService.refreshSkills();
    return { status: 'success', skill };
  }
}

function normalizeSkillMarkdown(content: string) {
  return content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}
