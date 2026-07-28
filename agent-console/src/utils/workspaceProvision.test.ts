import { describe, expect, it } from 'vitest';

import { AgentConsoleApiError } from '../adapters/api/http';
import { isWorkspaceNotProvisionedError } from './workspaceProvision';

describe('isWorkspaceNotProvisionedError', () => {
  it('detects workspace_not_provisioned 404', () => {
    const error = new AgentConsoleApiError('workspace_not_provisioned', {
      code: 'HTTP_ERROR',
      status: 404,
    });
    expect(isWorkspaceNotProvisionedError(error)).toBe(true);
  });

  it('ignores other HTTP errors', () => {
    const error = new AgentConsoleApiError('path_not_found', {
      code: 'HTTP_ERROR',
      status: 404,
    });
    expect(isWorkspaceNotProvisionedError(error)).toBe(false);
  });
});
