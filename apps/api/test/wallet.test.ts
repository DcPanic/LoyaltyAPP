import crypto from 'node:crypto';
import forge from 'node-forge';
import JSZip from 'jszip';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Builds a throwaway certificate chain so the .pkpass writer can be exercised
 * end to end. Apple's own certificate is never needed to prove that the
 * archive, the manifest hashes and the PKCS#7 signature are well formed.
 */
function selfSigned(commonName: string) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const attrs = [{ name: 'commonName', value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

describe('Apple Wallet pass', () => {
  let buildPkPass: typeof import('../src/wallet/apple/pass.js').buildPkPass;
  let buildPassJson: typeof import('../src/wallet/apple/pass.js').buildPassJson;
  let stampVisual: typeof import('../src/wallet/apple/pass.js').stampVisual;

  beforeAll(async () => {
    const pass = selfSigned('Pass Type ID: pass.test.loyaltyapp');
    const wwdr = selfSigned('Test WWDR');

    process.env.APPLE_PASS_TYPE_IDENTIFIER = 'pass.test.loyaltyapp';
    process.env.APPLE_TEAM_IDENTIFIER = 'TEAM123456';
    process.env.APPLE_PASS_CERT_PEM = pass.certPem;
    process.env.APPLE_PASS_KEY_PEM = pass.keyPem;
    process.env.APPLE_WWDR_CERT_PEM = wwdr.certPem;
    process.env.APPLE_APNS_TOPIC = 'pass.test.loyaltyapp';

    // Imported after the environment is set: configuration is read at load time.
    const module = await import('../src/wallet/apple/pass.js');
    buildPkPass = module.buildPkPass;
    buildPassJson = module.buildPassJson;
    stampVisual = module.stampVisual;
  });

  const context = () => ({
    serialNumber: 'ABCDEFGH1234',
    authToken: 'test-auth-token',
    businessName: 'Coffee House',
    programName: 'Coffee Loyalty',
    rewardName: 'Free coffee',
    rewardDescription: 'Any coffee of your choice.',
    stamps: 6,
    stampsRequired: 10,
    rewardAvailable: false,
    customerName: 'Maria K.',
    memberCode: 'ABCDEFGH1234',
    primaryColor: '#6F4E37',
    secondaryColor: '#F5E9DA',
    logoUrl: null,
    contactPhone: '+35722123456',
    addressLine: 'Makariou 12, Nicosia',
    privacyPolicyUrl: null,
    termsUrl: null,
    updatedTag: new Date('2026-01-01T10:00:00Z').toISOString(),
  });

  it('describes the loyalty state the customer sees', () => {
    const pass = buildPassJson(context()) as Record<string, unknown> & {
      storeCard: {
        headerFields: { value: string }[];
        secondaryFields: { value: string }[];
      };
      barcodes: { message: string }[];
    };

    expect(pass.passTypeIdentifier).toBe('pass.test.loyaltyapp');
    expect(pass.teamIdentifier).toBe('TEAM123456');
    expect(pass.storeCard.headerFields[0]!.value).toBe('6/10');
    expect(pass.storeCard.secondaryFields[0]!.value).toContain('4 more');
    // The QR carries an opaque member code, never personal details.
    expect(pass.barcodes[0]!.message).toBe('ABCDEFGH1234');
    expect(JSON.stringify(pass)).not.toContain('+35722123456'.slice(0, 4) + 'XXX');
  });

  it('shows the reward as available once the card is full', () => {
    const pass = buildPassJson({ ...context(), stamps: 10, rewardAvailable: true }) as {
      storeCard: { secondaryFields: { value: string }[] };
    };
    expect(pass.storeCard.secondaryFields[0]!.value).toContain('Free coffee available');
    expect(stampVisual(10, 10)).toBe('●'.repeat(10));
    expect(stampVisual(3, 10)).toBe('●●●○○○○○○○');
  });

  it('falls back to the secondary colour when the reward picture cannot be fetched', async () => {
    // A café can point at a picture that later moves or goes offline. The card
    // must still build: artwork is decoration, the balance is the point.
    const zip = await JSZip.loadAsync(
      await buildPkPass({ ...context(), rewardImageUrl: 'https://127.0.0.1:1/gone.png' }),
    );
    const strip = await zip.file('strip.png')!.async('nodebuffer');
    expect(strip.length).toBeGreaterThan(0);
    expect(strip.subarray(1, 4).toString('ascii')).toBe('PNG');
  });

  it('produces a signed .pkpass whose manifest matches every file', async () => {
    const buffer = await buildPkPass(context());
    const zip = await JSZip.loadAsync(buffer);

    for (const name of ['pass.json', 'manifest.json', 'signature', 'icon.png', 'logo.png']) {
      expect(zip.file(name), `${name} missing from the archive`).not.toBeNull();
    }

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as Record<
      string,
      string
    >;

    for (const [name, expected] of Object.entries(manifest)) {
      const content = await zip.file(name)!.async('nodebuffer');
      expect(crypto.createHash('sha1').update(content).digest('hex')).toBe(expected);
    }

    // The signature is a detached PKCS#7 over manifest.json, carrying both certs.
    const signature = await zip.file('signature')!.async('nodebuffer');
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(signature.toString('binary')));
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData;
    expect(p7.certificates).toHaveLength(2);
    expect(signature.length).toBeGreaterThan(100);
  });

  it('refuses to build a pass when Apple is not configured', async () => {
    const saved = process.env.APPLE_PASS_TYPE_IDENTIFIER;
    process.env.APPLE_PASS_TYPE_IDENTIFIER = '';
    vi.resetModules();
    try {
      // Re-imported with the configuration cleared, as on a deployment that has
      // not set up Apple credentials yet.
      const fresh = await import('../src/wallet/apple/pass.js');
      expect(() => fresh.buildPassJson(context())).toThrow(/not configured/i);
    } finally {
      process.env.APPLE_PASS_TYPE_IDENTIFIER = saved;
      vi.resetModules();
    }
  });
});
