export function WalletButtons({
  wallet,
  available,
}: {
  wallet: { apple: string | null; google: string | null };
  available: { apple: boolean; google: boolean };
}) {
  if (!available.apple && !available.google) {
    return (
      <div className="alert info" style={{ textAlign: 'left' }}>
        Wallet passes are not switched on for this café yet — your card works from the link below.
      </div>
    );
  }

  return (
    <div className="wallet-buttons">
      {wallet.apple && (
        <a className="wallet-btn" href={wallet.apple}>
           Add to Apple Wallet
        </a>
      )}
      {wallet.google && (
        <a className="wallet-btn google" href={wallet.google}>
          Add to Google Wallet
        </a>
      )}
    </div>
  );
}
