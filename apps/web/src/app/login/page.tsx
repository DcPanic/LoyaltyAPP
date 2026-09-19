import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in — LoyaltyApp' };

export default async function LoginPage() {
  if (await getSession()) redirect('/');
  return (
    <main className="public">
      <div className="public-inner">
        <div className="public-logo" aria-hidden>☕</div>
        <h1 className="center">Welcome back</h1>
        <p className="center hint">Sign in to your café dashboard.</p>
        <div className="card">
          <LoginForm />
        </div>
        <p className="center hint" style={{ marginTop: '1rem' }}>
          New here? <Link href="/register">Create your café account</Link>
        </p>
      </div>
    </main>
  );
}
