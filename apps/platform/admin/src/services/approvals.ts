import {
  ApprovalQueue,
  InMemoryApprovalStore,
  type ApprovalDispatcher,
  type DispatchResult,
} from '@teamsuzie/approvals';

/**
 * Generic fallback action type used when callers don't have a specific
 * dispatcher registered yet. Keeps the queue lifecycle clean (pending →
 * approved → dispatched) while real dispatchers land phase by phase.
 */
export const ACTION_AGENT_ACTION = 'agent.action';

/**
 * No-op dispatcher that simply records the item as dispatched. Real
 * side-effectful dispatchers (email send, file delete, etc.) plug in the
 * same way — see starter-ops-console/src/services/approvals.ts for a
 * working example tied to a concrete payload.
 */
function createNoopDispatcher(): ApprovalDispatcher {
  return {
    action_type: ACTION_AGENT_ACTION,
    async dispatch(): Promise<DispatchResult> {
      return { success: true };
    },
  };
}

export function createApprovalQueue(): ApprovalQueue {
  const store = new InMemoryApprovalStore();
  const queue = new ApprovalQueue({ store });
  queue.registerDispatcher(createNoopDispatcher());
  return queue;
}
