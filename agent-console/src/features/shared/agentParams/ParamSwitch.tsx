import { Switch } from '@lobehub/ui/base-ui';
import { memo } from 'react';

/** §C.5 Params*/
export const ParamSwitch = memo(function ParamSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      size="small"
      onChange={onChange}
    />
  );
});
