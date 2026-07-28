import type { FollowUpChip, FollowUpFetchParams } from '../domain/types/followUp';

/** Mock follow-up suggestions — replace with API in apiAdapter. */
export async function fetchFollowUpChips(_params: FollowUpFetchParams): Promise<FollowUpChip[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 280));

  return [
    { label: '能再详细说明一下吗？', message: '能再详细说明一下吗？' },
    { label: '有没有更简单的做法？', message: '有没有更简单的做法？' },
    { label: '帮我列一个步骤清单', message: '帮我列一个步骤清单' },
  ];
}
