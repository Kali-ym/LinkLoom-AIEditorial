import { memo } from 'react';

import type { ModelWithProviders } from '../../types';
import { ModelItemRender } from '../ModelItemRender';

interface SingleProviderModelItemProps {
  data: ModelWithProviders;
}

export const SingleProviderModelItem = memo(function SingleProviderModelItem({
  data,
}: SingleProviderModelItemProps) {
  return (
    <ModelItemRender
      {...data.model}
      {...data.model.abilities}
      displayName={data.displayName}
      id={data.model.id}
    />
  );
});
