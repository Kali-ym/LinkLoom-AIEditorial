import { Center, Flexbox, Icon, Text } from '@lobehub/ui';
import { Loader2 } from 'lucide-react';
import { memo } from 'react';

import { portalStrings } from '../features/Portal/portalStrings';

/** §C.21 FilePreview loading*/
export const CircleLoading = memo(function CircleLoading({
  label = portalStrings.filePreview.loading,
}: {
  label?: string;
}) {
  return (
    <Center height="100%" width="100%">
      <Flexbox align="center" gap={8}>
        <Icon icon={Loader2} size="large" spin />
        <Text type="secondary">{label}</Text>
      </Flexbox>
    </Center>
  );
});
