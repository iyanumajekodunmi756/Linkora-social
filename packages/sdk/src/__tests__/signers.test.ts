/* eslint-disable @typescript-eslint/no-explicit-any */
import { FreighterSigner } from "../signers/freighter";
import { LedgerSigner } from "../signers/ledger";

// ── FreighterSigner mocks ─────────────────────────────────────────────────────

const mockFreighterSign = jest.fn();
const mockFreighterGetPublicKey = jest.fn();

// ── LedgerSigner transport / app mocks ───────────────────────────────────────

const mockClose = jest.fn();
const mockTransport = { close: mockClose };

const mockGetPublicKey = jest.fn();
const mockLedgerSignTransaction = jest.fn();
const mockStrAppInstance = {
  getPublicKey: mockGetPublicKey,
  signTransaction: mockLedgerSignTransaction,
};
const mockStrAppConstructor = jest.fn(() => mockStrAppInstance);

const mockNodeHIDTransport = {
  list: jest.fn(),
  open: jest.fn(),
};

const mockWebHIDTransport = {
  create: jest.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────

describe("FreighterSigner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).window = {
      freighter: {
        getPublicKey: mockFreighterGetPublicKey,
        signTransaction: mockFreighterSign,
      },
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it("should throw error if Freighter is not available", () => {
    delete (global as any).window;
    expect(() => new FreighterSigner()).toThrow("Freighter extension not found");
  });

  it("should get public key from Freighter", async () => {
    mockFreighterGetPublicKey.mockResolvedValue("GPUBLICKEY123");

    const signer = new FreighterSigner();
    const publicKey = await signer.getPublicKey();

    expect(publicKey).toBe("GPUBLICKEY123");
    expect(mockFreighterGetPublicKey).toHaveBeenCalled();
  });

  it("should cache public key on subsequent calls", async () => {
    mockFreighterGetPublicKey.mockResolvedValue("GPUBLICKEY123");

    const signer = new FreighterSigner();
    await signer.getPublicKey();
    await signer.getPublicKey();

    expect(mockFreighterGetPublicKey).toHaveBeenCalledTimes(1);
  });

  it("should sign transaction with Freighter", async () => {
    mockFreighterGetPublicKey.mockResolvedValue("GPUBLICKEY123");
    mockFreighterSign.mockResolvedValue("SIGNEDURLSTRING");

    const signer = new FreighterSigner();
    const result = await signer.signTransaction("fakexdrstring");

    expect(result).toBe("SIGNEDURLSTRING");
    expect(mockFreighterSign).toHaveBeenCalledWith("fakexdrstring");
  });

  it("should throw error if Freighter sign fails", async () => {
    mockFreighterSign.mockRejectedValue(new Error("User rejected"));

    const signer = new FreighterSigner();

    await expect(signer.signTransaction("fakexdrstring")).rejects.toThrow(
      "Failed to sign transaction with Freighter"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("LedgerSigner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClose.mockResolvedValue(undefined);
    mockNodeHIDTransport.list.mockResolvedValue(["device0"]);
    mockNodeHIDTransport.open.mockResolvedValue(mockTransport);
    mockStrAppConstructor.mockImplementation(() => mockStrAppInstance);

    jest.mock("@ledgerhq/hw-transport-webhid", () => ({
      default: mockWebHIDTransport,
    }));
    jest.mock("@ledgerhq/hw-transport-node-hid", () => ({
      default: mockNodeHIDTransport,
    }));
    jest.mock("@ledgerhq/hw-app-str", () => ({
      default: mockStrAppConstructor,
    }));
  });

  afterEach(() => {
    jest.unmock("@ledgerhq/hw-transport-webhid");
    jest.unmock("@ledgerhq/hw-transport-node-hid");
    jest.unmock("@ledgerhq/hw-app-str");
  });

  it("should initialize LedgerSigner", () => {
    const signer = new LedgerSigner();
    expect(signer).toBeDefined();
  });

  it("close does not throw when transport is not initialized", async () => {
    const signer = new LedgerSigner();
    await expect(signer.close()).resolves.not.toThrow();
  });

  it("should provide getPublicKey and signTransaction interface", () => {
    const signer = new LedgerSigner();
    expect(typeof signer.getPublicKey).toBe("function");
    expect(typeof signer.signTransaction).toBe("function");
  });

  it("should get public key via mocked Node HID transport", async () => {
    mockGetPublicKey.mockResolvedValue({ publicKey: "GPUBKEY123LEDGER" });

    const signer = new LedgerSigner();
    const pubKey = await signer.getPublicKey("m/44'/148'/0'");

    expect(pubKey).toBe("GPUBKEY123LEDGER");
    expect(mockGetPublicKey).toHaveBeenCalledWith("m/44'/148'/0'");
  });

  it("should cache public key per derivation path (not globally)", async () => {
    mockGetPublicKey
      .mockResolvedValueOnce({ publicKey: "GPUBKEY_PATH_0" })
      .mockResolvedValueOnce({ publicKey: "GPUBKEY_PATH_1" });

    const signer = new LedgerSigner();
    const key0 = await signer.getPublicKey("m/44'/148'/0'");
    const key1 = await signer.getPublicKey("m/44'/148'/1'");

    expect(key0).toBe("GPUBKEY_PATH_0");
    expect(key1).toBe("GPUBKEY_PATH_1");
    // Each derivation path fetched exactly once
    expect(mockGetPublicKey).toHaveBeenCalledTimes(2);
  });

  it("should return cached public key on repeated calls for the same path", async () => {
    mockGetPublicKey.mockResolvedValue({ publicKey: "GPUBKEY_CACHED" });

    const signer = new LedgerSigner();
    await signer.getPublicKey("m/44'/148'/0'");
    await signer.getPublicKey("m/44'/148'/0'");
    await signer.getPublicKey("m/44'/148'/0'");

    expect(mockGetPublicKey).toHaveBeenCalledTimes(1);
  });

  it("should sign a Transaction object and attach a DecoratedSignature", async () => {
    const mockSigBuffer = Buffer.alloc(64, 0xab);
    // Use a real valid Stellar ed25519 public key (StrKey-encoded)
    const testPublicKey = "GBVG2QOHHFBVHAEGNF4XRUCAPAGWDROONM2LC4BK6KAISARSLA2UHYHS";

    mockGetPublicKey.mockResolvedValue({ publicKey: testPublicKey });
    mockLedgerSignTransaction.mockResolvedValue({ signature: mockSigBuffer });

    const signer = new LedgerSigner();

    const mockTx = {
      toEnvelope: jest.fn(() => ({
        toXDR: jest.fn(() => Buffer.from("deadbeef", "hex").toString("base64")),
      })),
      signatures: [] as any[],
    };

    const result = await signer.signTransaction(mockTx, "m/44'/148'/0'");

    // signTransaction must return the same transaction object (mutated in place)
    expect(result).toBe(mockTx);
    // Exactly one signature must have been appended
    expect(mockTx.signatures).toHaveLength(1);
    // Ledger app must have been called with the raw XDR bytes
    expect(mockLedgerSignTransaction).toHaveBeenCalledWith("m/44'/148'/0'", expect.any(Buffer));
  });

  it("should return base64 signature string when tx input is an XDR string", async () => {
    const mockSigBuffer = Buffer.alloc(64, 0xcd);
    mockLedgerSignTransaction.mockResolvedValue({ signature: mockSigBuffer });

    const signer = new LedgerSigner();
    const result = await signer.signTransaction(
      Buffer.from("deadbeef", "hex").toString("base64"),
      "m/44'/148'/0'"
    );

    expect(typeof result).toBe("string");
    expect(result).toBe(mockSigBuffer.toString("base64"));
  });

  it("should invalidate public key cache on close()", async () => {
    mockGetPublicKey.mockResolvedValue({ publicKey: "GPUBKEY_CACHED" });

    const signer = new LedgerSigner();
    await signer.getPublicKey("m/44'/148'/0'");
    // Cache is populated; second call should be a no-op
    expect(mockGetPublicKey).toHaveBeenCalledTimes(1);

    // Reconnect with a different device — close clears the cache
    await signer.close();
    expect(mockClose).toHaveBeenCalledTimes(1);

    // After close, a fresh getPublicKey should hit the device again
    await signer.getPublicKey("m/44'/148'/0'");
    expect(mockGetPublicKey).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Signer interface", () => {
  beforeEach(() => {
    (global as any).window = {
      freighter: {
        getPublicKey: jest.fn(),
        signTransaction: jest.fn(),
      },
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it("should have consistent interface across implementations", () => {
    const freighterSigner = new FreighterSigner();
    const ledgerSigner = new LedgerSigner();

    expect(typeof freighterSigner.getPublicKey).toBe("function");
    expect(typeof freighterSigner.signTransaction).toBe("function");
    expect(typeof ledgerSigner.getPublicKey).toBe("function");
    expect(typeof ledgerSigner.signTransaction).toBe("function");
  });
});
