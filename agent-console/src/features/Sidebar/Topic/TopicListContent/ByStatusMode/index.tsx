import { memo } from 'react';

import { GroupedAccordion } from '../GroupedAccordion';
import { ByStatusGroupItem } from './GroupItem';

export const ByStatusMode = memo(function ByStatusMode() {
  return <GroupedAccordion GroupItem={ByStatusGroupItem} />;
});
