import { LocalStore } from '../backend/src/services/LocalStore.js';
import { HotStoryMergeService } from '../backend/src/services/feed/HotStoryMergeService.js';

async function main() {
  const store = new LocalStore();
  await store.init();
  try {
    const result = await new HotStoryMergeService(store).runMergeAndSnapshot(new Date());
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await store.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
