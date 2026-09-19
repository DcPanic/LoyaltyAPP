import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { RegisterForm } from './RegisterForm';

export const metadata = { title: 'Create your café account — LoyaltyApp' };

export default async function RegisterPage() {
  if (await getSession()) redirect('/');
  return (
    <main className="public">
      <div className="public-inner">
        <div className="public-logo" aria-hidden>☕</div>
        <h1 className="center">Start your loyalty program</h1>
        <p className="center hint">
          Free for 14 days. Your customers never need to install an app.
        </p>
        <div className="card">
          <RegisterForm />
        </div>
        <p className="center hint" style={{ marginTop: '1rem' }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
