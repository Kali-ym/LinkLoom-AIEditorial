import { memo } from 'react';

import { GroupedAccordion } from '../GroupedAccordion';
import { ByTimeGroupItem } from './GroupItem';

export const ByTimeMode = memo(function ByTimeMode() {
  return <GroupedAccordion GroupItem={ByTimeGroupItem} />;
});
