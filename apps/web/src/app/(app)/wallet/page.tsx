import { api } from '@/lib/api';
import { requirePermission } from '@/lib/session';

interface Check {
  key: string;
  label: string;
  set: boolean;
  required: boolean;
}

interface WalletSetup {
  apple: {
    configured: boolean;
    checks: Check[];
    passTypeIdentifier: string | null;
    certificate: { selfSigned: boolean | null; commonName: string | null; expiresAt: string | null };
    passes: number;
    devices: number;
  };
  google: {
    configured: boolean;
    checks: Check[];
    issuerId: string | null;
    passes: number;
  };
  webService: { url: string; https: boolean };
  lastPush: { at: string | null; platform: string } | null;
}

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <table>
      <tbody>
        {checks.map((check) => (
          <tr key={check.key}>
            <td>
              <strong>{check.label}</strong>
              <br />
              <small className="member-code">{check.key}</small>
            </td>
            <td style={{ textAlign: 'right' }}>
              {check.set ? (
                <span className="badge ok">set</span>
              ) : (
                <span className={`badge ${check.required ? 'off' : 'at_risk'}`}>
                  {check.required ? 'missing' : 'optional'}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const metadata = { title: 'Wallet cards — LoyaltyApp' };

export default async function WalletPage() {
  await requirePermission('settings:manage');
  const setup = await api<WalletSetup>('/v1/business/wallet');

  const appleReady = setup.apple.configured && setup.apple.certificate.selfSigned === false;

  return (
    <>
      <div className="topbar">
        <h1>Wallet cards</h1>
      </div>

      <div className="card">
        <p className="hint" style={{ marginBottom: 0 }}>
          Your customers keep their loyalty card in Apple Wallet or Google Wallet — no app to
          install. This platform builds and signs those passes itself with your own Apple and
          Google credentials, so there is no per-card fee to any pass provider. Until the
          credentials below are in place, customers still get a working card at its web address
          and can keep it on their home screen.
        </p>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-header">
            <h2> Apple Wallet</h2>
            <span className={`badge ${appleReady ? 'ok' : setup.apple.configured ? 'at_risk' : 'off'}`}>
              {appleReady ? 'live' : setup.apple.configured ? 'development only' : 'not configured'}
            </span>
          </div>

          {setup.apple.certificate.selfSigned && (
            <div className="alert error">
              This is a self-signed development certificate. The flow works end to end, but an
              iPhone will refuse to install the pass. Replace it with your Apple pass certificate
              before letting customers use it.
            </div>
          )}

          <CheckList checks={setup.apple.checks} />

          <p className="hint" style={{ marginTop: '0.75rem' }}>
            {setup.apple.passes} cards issued · {setup.apple.devices} devices registered for live
            updates
            {setup.apple.certificate.expiresAt &&
              ` · certificate valid until ${new Date(setup.apple.certificate.expiresAt).toLocaleDateString()}`}
          </p>

          <h3 style={{ marginTop: '1rem' }}>How to switch it on</h3>
          <ol className="hint" style={{ paddingLeft: '1.1rem' }}>
            <li>Join the Apple Developer Program (€99 / year).</li>
            <li>
              Create a <strong>Pass Type ID</strong> and its certificate in the developer portal.
            </li>
            <li>Download the Apple WWDR G4 intermediate certificate.</li>
            <li>
              Convert them to PEM and set them on the API as environment variables — the exact
              commands are in <code>docs/WALLET.md</code>.
            </li>
          </ol>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Google Wallet</h2>
            <span className={`badge ${setup.google.configured ? 'ok' : 'off'}`}>
              {setup.google.configured ? 'live' : 'not configured'}
            </span>
          </div>

          <CheckList checks={setup.google.checks} />

          <p className="hint" style={{ marginTop: '0.75rem' }}>
            {setup.google.passes} cards issued
            {setup.google.issuerId ? ` · issuer ${setup.google.issuerId}` : ''}
          </p>

          <h3 style={{ marginTop: '1rem' }}>How to switch it on</h3>
          <ol className="hint" style={{ paddingLeft: '1.1rem' }}>
            <li>Request a Google Wallet API issuer account (free).</li>
            <li>
              Create a Google Cloud service account with the <em>Wallet Object Issuer</em> role and
              download its JSON key.
            </li>
            <li>Authorise that service account email in the Wallet console.</li>
            <li>
              Set the issuer id, the service account email and its private key on the API — see{' '}
              <code>docs/WALLET.md</code>.
            </li>
          </ol>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Card updates</h2>
          <small className="hint">
            {setup.lastPush?.at
              ? `Last update ${new Date(setup.lastPush.at).toLocaleString()} (${setup.lastPush.platform.toLowerCase()})`
              : 'No card updates sent yet'}
          </small>
        </div>
        <p className="hint">
          Every stamp, redemption and correction refreshes the customer&apos;s card. Apple devices
          call back to your pass web service, so it has to be reachable over HTTPS from the public
          internet.
        </p>
        <div className="field">
          <label htmlFor="webservice">Pass web service address</label>
          <input id="webservice" readOnly value={setup.webService.url} />
        </div>
        {!setup.webService.https && (
          <div className="alert info">
            This address is not HTTPS, which is fine on your own machine but will not work for real
            iPhones. Set <code>API_URL</code> to your public HTTPS address before going live —
            it is written into every pass that has already been issued.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Try it before Apple approves you</h2>
        </div>
        <p className="hint">
          On your own machine you can generate a throwaway certificate and see the whole flow —
          the button appears, the pass is built, signed and updated on every stamp:
        </p>
        <pre
          style={{
            background: 'var(--cream)',
            padding: '0.9rem',
            borderRadius: 'var(--radius-sm)',
            overflowX: 'auto',
            fontSize: '0.85rem',
          }}
        >
          npm run wallet:dev-certs -w @loyaltyapp/api -- --write
        </pre>
        <p className="hint" style={{ marginBottom: 0 }}>
          Restart the API afterwards. Passes signed this way cannot be installed on a real iPhone —
          they are for development only.
        </p>
      </div>
    </>
  );
}
