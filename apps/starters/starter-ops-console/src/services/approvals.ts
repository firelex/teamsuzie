import {
  ApprovalQueue,
  InMemoryApprovalStore,
  type ApprovalDispatcher,
  type DispatchResult,
} from '@teamsuzie/approvals';
import { Contact } from '../models/contact.js';

export type DeleteContactPayload = {
  contact_id: string;
  organization_id: string;
};

export const ACTION_DELETE_CONTACT = 'contact.delete';

/**
 * Dispatcher for approved "delete contact" actions. Runs when an approval
 * item of type `contact.delete` is dispatched after human review.
 */
function createDeleteContactDispatcher(): ApprovalDispatcher<DeleteContactPayload> {
  return {
    action_type: ACTION_DELETE_CONTACT,
    async dispatch(item): Promise<DispatchResult> {
      const { contact_id, organization_id } = item.payload;
      const contact = await Contact.findOne({
        where: { id: contact_id, organization_id },
      });
      if (!contact) {
        return { success: false, error: 'Contact no longer exists' };
      }
      await contact.destroy();
      return { success: true };
    },
  };
}

export function createApprovalQueue(): ApprovalQueue {
  const store = new InMemoryApprovalStore();
  const queue = new ApprovalQueue({ store });
  queue.registerDispatcher(createDeleteContactDispatcher());
  return queue;
}
