import { memo } from 'react';

import { Controls } from '../../shared/agentParams/Controls';

/** §C.23 ParamsSection*/
export const ParamsSection = memo(function ParamsSection() {
  return <Controls variant="sidebar" />;
});

export default ParamsSection;
