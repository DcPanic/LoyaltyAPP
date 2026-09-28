import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in — LoyaltyApp' };

const CONFIRM_MESSAGE: Record<string, { tone: string; text: string }> = {
  ok: { tone: 'success', text: 'Email confirmed. Sign in to carry on.' },
  expired: {
    tone: 'error',
    text: 'That confirmation link had expired or been used. Sign in and ask for a new one.',
  },
  failed: { tone: 'error', text: 'That confirmation link could not be used.' },
  missing: { tone: 'error', text: 'That link was incomplete. Open the one in your email again.' },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  if (await getSession()) redirect('/');
  const { confirm } = await searchParams;
  const notice = confirm ? CONFIRM_MESSAGE[confirm] : undefined;

  return (
    <main className="public">
      <div className="public-inner">
        <div className="public-logo" aria-hidden>☕</div>
        <h1 className="center">Welcome back</h1>
        <p className="center hint">Sign in to your café dashboard.</p>
        <div className="card">
          {notice && <div className={`alert ${notice.tone}`}>{notice.text}</div>}
          <LoginForm />
        </div>
        <p className="center hint" style={{ marginTop: '1rem' }}>
          New here? <Link href="/register">Create your café account</Link>
        </p>
      </div>
    </main>
  );
}
