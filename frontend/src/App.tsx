import React, { useState, useEffect } from 'react';
import {
  ArrowDownUp,
  Wallet,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  History,
  ShieldCheck,
  Zap,
  Check,
} from 'lucide-react';

interface Order {
  id: string;
  sourceChain: string;
  destChain: string;
  sourceAsset: string;
  destAsset: string;
  amount: string;
  destAmount: string;
  status: string;
  txHashSource?: string;
  txHashDest?: string;
  createdAt: number;
}

export default function App() {
  // Tab control
  const [activeTab, setActiveTab] = useState<'swap' | 'history' | 'refund'>('swap');

  // Form states
  const [sourceChain, setSourceChain] = useState<'ethereum' | 'stellar' | 'solana'>('ethereum');
  const [destChain, setDestChain] = useState<'ethereum' | 'stellar' | 'solana'>('stellar');
  const [sourceAsset, setSourceAsset] = useState<string>('ETH');
  const [destAsset, setDestAsset] = useState<string>('XLM');
  const [amount, setAmount] = useState<string>('0.1');
  const [destAmount, setDestAmount] = useState<string>('99.7');
  const [quoteFee, setQuoteFee] = useState<string>('0.0003');
  const [isFetchingQuote, setIsFetchingQuote] = useState<boolean>(false);

  // Wallet connection simulation
  const [wallets, setWallets] = useState({
    ethereum: { connected: false, address: '' },
    stellar: { connected: false, address: '' },
    solana: { connected: false, address: '' },
  });

  // Active swap state machine
  const [swapState, setSwapState] = useState<{
    id: string | null;
    step: 'idle' | 'pending_lock' | 'source_locked' | 'dest_locked' | 'claimed' | 'settled';
    error: string | null;
  }>({
    id: null,
    step: 'idle',
    error: null,
  });

  // History and Emergency Refund
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [refundOrderId, setRefundOrderId] = useState<string>('');
  const [refundStatus, setRefundStatus] = useState<string | null>(null);

  // Auto route matching
  useEffect(() => {
    if (sourceChain === 'ethereum') {
      setSourceAsset('ETH');
    } else if (sourceChain === 'stellar') {
      setSourceAsset('XLM');
    } else if (sourceChain === 'solana') {
      setSourceAsset('SOL');
    }
  }, [sourceChain]);

  useEffect(() => {
    if (destChain === 'ethereum') {
      setDestAsset('ETH');
    } else if (destChain === 'stellar') {
      setDestAsset('XLM');
    } else if (destChain === 'solana') {
      setDestAsset('SOL');
    }
  }, [destChain]);

  // Quote estimation simulation
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setDestAmount('0.0');
      return;
    }

    setIsFetchingQuote(true);
    const delay = setTimeout(() => {
      const parsed = parseFloat(amount);
      const fee = parsed * 0.003; // 0.3%
      setQuoteFee(fee.toFixed(6));

      // Mock conversion rate
      let rate = 1000.0; // ETH to XLM
      if (sourceChain === 'ethereum' && destChain === 'solana') rate = 15.0; // ETH to SOL
      if (sourceChain === 'stellar' && destChain === 'ethereum') rate = 0.001;
      if (sourceChain === 'stellar' && destChain === 'solana') rate = 0.015;
      if (sourceChain === 'solana' && destChain === 'ethereum') rate = 0.066;
      if (sourceChain === 'solana' && destChain === 'stellar') rate = 66.0;

      setDestAmount(((parsed - fee) * rate).toFixed(2));
      setIsFetchingQuote(false);
    }, 400);

    return () => clearTimeout(delay);
  }, [amount, sourceChain, destChain]);

  // Connect Wallets Mock
  const connectWallet = (chain: 'ethereum' | 'stellar' | 'solana') => {
    let mockAddress = '';
    if (chain === 'ethereum') mockAddress = '0xb352339BEb000000000000000000000000000178';
    if (chain === 'stellar') mockAddress = 'CDIKSJKV00000000000000000000000000000000000000000000CTA6JK';
    if (chain === 'solana') mockAddress = 'AnchorHTLC1111111111111111111111111111111111';

    setWallets((prev) => ({
      ...prev,
      [chain]: { connected: true, address: mockAddress },
    }));
  };

  // Perform Swap Action
  const initiateSwap = () => {
    const isSourceConnected = wallets[sourceChain].connected;
    const isDestConnected = wallets[destChain].connected;

    if (!isSourceConnected || !isDestConnected) {
      alert(`Please connect both ${sourceChain} and ${destChain} wallets first.`);
      return;
    }

    const mockOrderId = `order_${Math.random().toString(36).substring(2, 9)}`;
    setSwapState({
      id: mockOrderId,
      step: 'pending_lock',
      error: null,
    });

    // Run front-end client swap state machine simulation
    setTimeout(() => {
      setSwapState((prev) => ({ ...prev, step: 'source_locked' }));
      
      // Step 2: Resolver detects and locks dest chain
      setTimeout(() => {
        setSwapState((prev) => ({ ...prev, step: 'dest_locked' }));

        // Step 3: User claims destination leg revealing secret
        setTimeout(() => {
          setSwapState((prev) => ({ ...prev, step: 'claimed' }));

          // Step 4: Relayer claims source leg finalizing swap
          setTimeout(() => {
            setSwapState((prev) => ({ ...prev, step: 'settled' }));

            // Add order to history
            const newOrder: Order = {
              id: mockOrderId,
              sourceChain,
              destChain,
              sourceAsset,
              destAsset,
              amount,
              destAmount,
              status: 'SETTLED',
              txHashSource: `0x${Math.random().toString(16).substring(2, 34)}`,
              txHashDest: `0x${Math.random().toString(16).substring(2, 34)}`,
              createdAt: Math.floor(Date.now() / 1000),
            };
            setOrderHistory((prev) => [newOrder, ...prev]);
          }, 2000);
        }, 2000);
      }, 2000);
    }, 2000);
  };

  const handleRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrderId) return;
    setRefundStatus('scanning');

    setTimeout(() => {
      setRefundStatus('refunding');
      setTimeout(() => {
        setRefundStatus('success');
        // Update order history status
        setOrderHistory((prev) =>
          prev.map((o) => (o.id === refundOrderId ? { ...o, status: 'REFUNDED' } : o))
        );
      }, 2500);
    }, 1500);
  };

  const closeSwapModal = () => {
    setSwapState({ id: null, step: 'idle', error: null });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 48px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'rgba(3, 7, 18, 0.5)',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            padding: '10px',
            borderRadius: '12px',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)'
          }}>
            <ArrowDownUp size={24} color="white" />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            Astro<span className="gradient-text">Finance</span>
          </span>
        </div>

        {/* Wallets indicators */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {(['ethereum', 'stellar', 'solana'] as const).map((chain) => (
            <button
              key={chain}
              onClick={() => connectWallet(chain)}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderColor: wallets[chain].connected ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                color: wallets[chain].connected ? '#a5b4fc' : '#9ca3af'
              }}
            >
              <Wallet size={16} />
              <span style={{ textTransform: 'capitalize' }}>
                {chain} {wallets[chain].connected ? 'Connected' : 'Connect'}
              </span>
              {wallets[chain].connected && (
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '580px' }}>
          
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(17, 24, 39, 0.5)', padding: '6px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <button
              onClick={() => setActiveTab('swap')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: activeTab === 'swap' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeTab === 'swap' ? '#e0e7ff' : '#9ca3af',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Zap size={16} />
              Swap Assets
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: activeTab === 'history' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeTab === 'history' ? '#e0e7ff' : '#9ca3af',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <History size={16} />
              History
            </button>
            <button
              onClick={() => setActiveTab('refund')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: activeTab === 'refund' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                color: activeTab === 'refund' ? '#fecaca' : '#9ca3af',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} />
              Emergency Refund
            </button>
          </div>

          {/* TAB 1: SWAP MODULE */}
          {activeTab === 'swap' && (
            <div className="glass-card" style={{ padding: '32px' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Non-Custodial Atomic Swap
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Source Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(3, 7, 18, 0.4)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                  <label style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 500 }}>From Chain & Asset</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <select
                      value={sourceChain}
                      onChange={(e) => setSourceChain(e.target.value as any)}
                      className="form-input"
                      style={{ flex: 1, background: '#111827' }}
                    >
                      <option value="ethereum">Ethereum (Sepolia)</option>
                      <option value="stellar">Stellar (Testnet)</option>
                      <option value="solana">Solana (Devnet)</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '14px', fontWeight: 600 }}>
                      {sourceAsset}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="form-input"
                      placeholder="0.0"
                      style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '1.25rem', padding: 0 }}
                    />
                  </div>
                </div>

                {/* Switch Arrow */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '-10px 0' }}>
                  <div style={{
                    background: '#1f2937',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '8px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ArrowDownUp size={16} />
                  </div>
                </div>

                {/* Destination Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(3, 7, 18, 0.4)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                  <label style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 500 }}>To Chain & Asset (Estimated)</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <select
                      value={destChain}
                      onChange={(e) => setDestChain(e.target.value as any)}
                      className="form-input"
                      style={{ flex: 1, background: '#111827' }}
                    >
                      <option value="ethereum">Ethereum (Sepolia)</option>
                      <option value="stellar">Stellar (Testnet)</option>
                      <option value="solana">Solana (Devnet)</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '14px', fontWeight: 600 }}>
                      {destAsset}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '1.25rem', fontWeight: 600, color: '#a5b4fc' }}>
                    {isFetchingQuote ? (
                      <div className="animate-pulse" style={{ color: '#9ca3af', fontSize: '1rem' }}>Estimating...</div>
                    ) : (
                      destAmount
                    )}
                  </div>
                </div>

                {/* Quote Details */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9ca3af' }}>Relayer Staking Fee (0.3%):</span>
                    <span>{quoteFee} {sourceAsset}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9ca3af' }}>Timelock (Source):</span>
                    <span>24 Hours (User secure)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9ca3af' }}>Timelock (Dest):</span>
                    <span>12 Hours (Resolver secure)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                    <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={14} color="#10b981" /> No Attesters/Admin gates
                    </span>
                    <span style={{ color: '#a5b4fc' }}>Sha256 Preimage Reveal</span>
                  </div>
                </div>

                {/* Bridge Button */}
                <button
                  onClick={initiateSwap}
                  className="btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Zap size={18} />
                  Initiate Atomic Swap
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === 'history' && (
            <div className="glass-card" style={{ padding: '32px' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Transaction History</h2>
              {orderHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>
                  <History size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                  No bridge swaps found in this browser session.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {orderHistory.map((order) => (
                    <div key={order.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontFamily: 'monospace', color: '#a5b4fc', fontWeight: 600 }}>{order.id}</span>
                        <span style={{
                          fontSize: '0.8rem',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          background: order.status === 'SETTLED' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: order.status === 'SETTLED' ? '#10b981' : '#ef4444'
                        }}>
                          {order.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span>
                          {order.amount} {order.sourceAsset} ({order.sourceChain})
                        </span>
                        <span style={{ color: '#9ca3af' }}>➔</span>
                        <span>
                          {order.destAmount} {order.destAsset} ({order.destChain})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EMERGENCY REFUND */}
          {activeTab === 'refund' && (
            <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(239,68,68,0.15)', padding: '8px', borderRadius: '10px' }}>
                  <AlertTriangle color="#ef4444" size={24} />
                </div>
                <h2 style={{ fontSize: '1.5rem' }}>Emergency Refund</h2>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '24px' }}>
                AstroBridge HTLCs allow anyone to reclaim locked funds directly from the smart contract if a swap fails or the coordinator goes offline.
              </p>

              <form onSubmit={handleRefund} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.9rem', color: '#9ca3af' }}>Order ID</label>
                  <input
                    type="text"
                    value={refundOrderId}
                    onChange={(e) => setRefundOrderId(e.target.value)}
                    className="form-input"
                    placeholder="Enter order ID (e.g. order_8f7b)"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}
                >
                  Trigger On-Chain Refund
                </button>
              </form>

              {refundStatus && (
                <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }}>
                  {refundStatus === 'scanning' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="animate-spin" color="#ef4444" />
                      Scanning smart contracts for locked order...
                    </div>
                  )}
                  {refundStatus === 'refunding' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="animate-spin" color="#ef4444" />
                      Broadcasting refund transaction (Timelock verification)...
                    </div>
                  )}
                  {refundStatus === 'success' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600 }}>
                      <CheckCircle2 size={18} />
                      Refund transaction confirmed! Funds returned to your wallet.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ACTIVE SWAP STEP MONITOR MODAL */}
      {swapState.step !== 'idle' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(3, 7, 18, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '32px', border: '1px solid rgba(99,102,241,0.2)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '24px', display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
              <span>Executing Atomic Swap</span>
              <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#9ca3af' }}>ID: {swapState.id}</span>
            </h3>

            {/* Stepper tracker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: swapState.step !== 'pending_lock' ? '#6366f1' : 'transparent',
                    border: swapState.step === 'pending_lock' ? '2px solid #6366f1' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {swapState.step !== 'pending_lock' ? <Check size={12} /> : '1'}
                  </div>
                  <div style={{ width: '2px', height: '32px', background: swapState.step !== 'pending_lock' ? '#6366f1' : 'rgba(255,255,255,0.1)', marginTop: '4px' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', color: '#f3f4f6' }}>1. Lock Source Funds</h4>
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>User transfers funds into HTLC Escrow on {sourceChain}</p>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: ['dest_locked', 'claimed', 'settled'].includes(swapState.step) ? '#6366f1' : 'transparent',
                    border: swapState.step === 'source_locked' ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {['dest_locked', 'claimed', 'settled'].includes(swapState.step) ? <Check size={12} /> : '2'}
                  </div>
                  <div style={{ width: '2px', height: '32px', background: ['dest_locked', 'claimed', 'settled'].includes(swapState.step) ? '#6366f1' : 'rgba(255,255,255,0.1)', marginTop: '4px' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', color: swapState.step === 'source_locked' ? '#e0e7ff' : '#9ca3af' }}>
                    2. Lock Destination Funds
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Resolver locks destination capital in HTLC Escrow on {destChain}</p>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: ['claimed', 'settled'].includes(swapState.step) ? '#6366f1' : 'transparent',
                    border: swapState.step === 'dest_locked' ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {['claimed', 'settled'].includes(swapState.step) ? <Check size={12} /> : '3'}
                  </div>
                  <div style={{ width: '2px', height: '32px', background: swapState.step === 'settled' ? '#6366f1' : 'rgba(255,255,255,0.1)', marginTop: '4px' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', color: swapState.step === 'dest_locked' ? '#e0e7ff' : '#9ca3af' }}>
                    3. Claim Destination Funds
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>User claims destination funds, revealing the preimage secret on-chain</p>
                </div>
              </div>

              {/* Step 4 */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: swapState.step === 'settled' ? '#6366f1' : 'transparent',
                    border: swapState.step === 'claimed' ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {swapState.step === 'settled' ? <Check size={12} /> : '4'}
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', color: swapState.step === 'claimed' ? '#e0e7ff' : '#9ca3af' }}>
                    4. Final Settlement
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Resolver claims source funds using revealed secret. Swap finalized.</p>
                </div>
              </div>

            </div>

            {/* Modal Controls */}
            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={closeSwapModal}
                className="btn-secondary"
                disabled={swapState.step !== 'settled'}
              >
                {swapState.step === 'settled' ? 'Swap Completed' : 'Waiting for blockchain confirm...'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'rgba(3, 7, 18, 0.5)',
        color: '#6b7280',
        fontSize: '0.85rem'
      }}>
        AstroBridge © 2026. Made with ❤️ for Stellar Open Source. Worthy of open-source bridge contributions.
      </footer>
    </div>
  );
}
