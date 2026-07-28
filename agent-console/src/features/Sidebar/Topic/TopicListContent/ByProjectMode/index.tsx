import { memo } from 'react';

import { GroupedAccordion } from '../GroupedAccordion';
import { ByProjectGroupItem } from './GroupItem';

export const ByProjectMode = memo(function ByProjectMode() {
  return <GroupedAccordion GroupItem={ByProjectGroupItem} />;
});
