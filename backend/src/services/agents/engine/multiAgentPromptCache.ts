import { hashString } from './canonicalMessageSerializer.js';
import {
  derivePromptCacheKey,
  type PromptCacheContract,
  type PromptCachePolicy
} from './promptCacheContract.js';

export function applyMultiAgentPromptCachePolicy(
  child: PromptCacheContract,
  policy: PromptCachePolicy,
  parent?: PromptCacheContract
): PromptCacheContract {
  const next = { ...child, cachePolicy: policy };
  if (!parent || policy === 'isolated') return next;

  if (!parent.cacheEligibility) {
    return disableContract(next, 'parent_cache_contract_ineligible');
  }

  if (policy === 'inherit') {
    if (!hasCompatiblePrefix(child, parent)) {
      return disableContract(next, 'parent_cache_contract_mismatch');
    }
    return withNamespace(next, parent.cacheNamespace);
  }

  return withNamespace(
    next,
    `${parent.cacheNamespace}:derived:${hashString(
      `${child.cacheNamespace}:${child.variantHash}`,
      20
    )}`
  );
}

function withNamespace(contract: PromptCacheContract, cacheNamespace: string): PromptCacheContract {
  return {
    ...contract,
    cacheNamespace,
    cacheKey: derivePromptCacheKey(cacheNamespace)
  };
}

function hasCompatiblePrefix(child: PromptCacheContract, parent: PromptCacheContract): boolean {
  return (
    child.providerId === parent.providerId &&
    child.model === parent.model &&
    child.endpoint === parent.endpoint &&
    child.reasoningMode === parent.reasoningMode &&
    child.promptSchemaVersion === parent.promptSchemaVersion &&
    child.historySerializationVersion === parent.historySerializationVersion &&
    child.stablePrefixHash === parent.stablePrefixHash &&
    child.toolsetHash === parent.toolsetHash
  );
}

function disableContract(contract: PromptCacheContract, reason: string): PromptCacheContract {
  return {
    ...contract,
    cacheEligibility: false,
    cacheDisableReason: contract.cacheDisableReason
      ? `${contract.cacheDisableReason};${reason}`
      : reason
  };
}
