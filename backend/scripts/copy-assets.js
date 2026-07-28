import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const srcPrompts = path.join(rootDir, 'src', 'prompts');
const distPrompts = path.join(rootDir, 'dist', 'prompts');
const srcSkills = path.join(rootDir, 'skills');
const distSkills = path.join(rootDir, 'dist', 'skills');
const srcTemplates = path.join(rootDir, 'templates');
const distTemplates = path.join(rootDir, 'dist', 'templates');

async function copyAssets() {
  try {
    // Copy prompts
    if (await fs.pathExists(srcPrompts)) {
      await fs.remove(distPrompts);
      await fs.ensureDir(distPrompts);
      await fs.copy(srcPrompts, distPrompts);
      console.log('✅ Prompts copied to dist/prompts');
    }
    
    // Copy skills
    if (await fs.pathExists(srcSkills)) {
      await fs.remove(distSkills);
      await fs.ensureDir(distSkills);
      await fs.copy(srcSkills, distSkills);
      console.log('✅ Skills copied to dist/skills');
    }

    if (await fs.pathExists(srcTemplates)) {
      await fs.remove(distTemplates);
      await fs.ensureDir(distTemplates);
      await fs.copy(srcTemplates, distTemplates);
      console.log('✅ Templates copied to dist/templates');
    }
    
    // You can add more assets to copy here if needed
    
  } catch (err) {
    console.error('❌ Error copying assets:', err);
    process.exit(1);
  }
}

copyAssets();
