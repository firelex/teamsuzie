import type { ToolDefinition } from './types';

interface ProposeActionArgs {
  action_type: string;
  payload: Record<string, unknown>;
  reason?: string;
}

export const proposeActionTool: ToolDefinition<ProposeActionArgs> = {
  name: 'propose_action',
  description:
    'Propose an action that requires human approval before execution. Use this for any operation with external effects (sending email, modifying records, calling external APIs). The action is queued, not executed — a human reviews and approves it.',
  parameters: {
    type: 'object',
    properties: {
      action_type: {
        type: 'string',
        description:
          'Discriminator for the action, e.g. "send_email", "delete_contact", "post_to_slack".',
      },
      payload: {
        type: 'object',
        description: 'The data the human reviewer needs to evaluate the action.',
        additionalProperties: true,
      },
      reason: {
        type: 'string',
        description: 'Short explanation of why this action is being proposed.',
      },
    },
    required: ['action_type', 'payload'],
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const proposal = await ctx.approvals.propose({
      subject_id: 'starter-chat',
      action_type: args.action_type,
      payload: args.payload,
      metadata: args.reason ? { reason: args.reason } : undefined,
    });

    return {
      id: proposal.id,
      status: proposal.status,
      action_type: proposal.action_type,
      message: `Action proposed for human review. ID=${proposal.id}. The user can approve or reject it; the model should communicate this clearly and not assume the action has been performed.`,
    };
  },
};
