import { Chat } from '@/components/chat';

export default function Page() {
  const title = process.env.NEXT_PUBLIC_APP_TITLE || 'Starter Chat (Vercel)';
  const agentName = process.env.NEXT_PUBLIC_AGENT_NAME || 'Suzie';
  return <Chat title={title} agentName={agentName} />;
}
