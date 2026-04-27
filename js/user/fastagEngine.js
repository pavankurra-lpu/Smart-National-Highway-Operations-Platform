// FASTag Wallet & Recharge Simulation

const FastagEngine = {
    init: () => {
        FastagEngine.updateUI();

        const btnRecharge = document.getElementById('btn-recharge');
        const inputAmount = document.getElementById('recharge-amount');
        
        if (inputAmount) {
            inputAmount.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 0;
                if (val >= 500) {
                    const fee = val * 0.01; // 1% platform fee
                    document.getElementById('recharge-fee').innerText = `- ₹${fee.toFixed(2)}`;
                    document.getElementById('recharge-net').innerText = `₹${(val - fee).toFixed(2)}`;
                } else {
                    document.getElementById('recharge-fee').innerText = `- ₹0.00`;
                    document.getElementById('recharge-net').innerText = `₹0.00`;
                }
            });
        }

        if (btnRecharge) {
            btnRecharge.addEventListener('click', () => {
                const amount = parseFloat(inputAmount.value);
                const gateway = document.getElementById('recharge-gateway').value;
                if (!amount || amount < 500) {
                    Utils.showToast("Minimum recharge is ₹500", "error");
                    return;
                }
                
                // Simulate 3rd Party Payment Flow
                btnRecharge.innerText = "Processing...";
                btnRecharge.disabled = true;

                setTimeout(() => {
                    const fee = amount * 0.01;
                    const net = amount - fee;
                    
                    let balance = Storage.get(Storage.KEYS.FASTAG_BALANCE, 0);
                    balance += net;
                    Storage.set(Storage.KEYS.FASTAG_BALANCE, balance);

                    // Add to history
                    const history = Storage.get(Storage.KEYS.RECHARGE_HISTORY, []);
                    history.unshift({
                        id: Utils.generateId('TXN'),
                        date: new Date().toISOString(),
                        amount: amount,
                        fee: fee,
                        net: net,
                        gateway: gateway
                    });
                    Storage.set(Storage.KEYS.RECHARGE_HISTORY, history);

                    Utils.showToast(`₹${net.toFixed(2)} credited via ${gateway} successfully!`, 'success');
                    btnRecharge.innerHTML = '<i class="fa-solid fa-lock"></i> Proceed to Pay';
                    btnRecharge.disabled = false;
                    inputAmount.value = '';
                    document.getElementById('recharge-fee').innerText = `- ₹0.00`;
                    document.getElementById('recharge-net').innerText = `₹0.00`;

                    FastagEngine.updateUI();
                }, 1500);
            });
        }

        // Listen for cross-tab updates (e.g. from Admin or multiple tabs)
        window.addEventListener('local-storage-update', () => {
            FastagEngine.updateUI();
        });
    },

    updateUI: () => {
        const balEl = document.getElementById('ui-fastag-bal');
        const statusEl = document.getElementById('ui-fastag-status');
        const histEl = document.getElementById('fastag-history-list');

        const balance = Storage.get(Storage.KEYS.FASTAG_BALANCE, 0);
        
        if (balEl) balEl.innerText = Utils.formatCurrency(balance);
        
        if (statusEl) {
            statusEl.className = 'badge';
            if (balance < 500) {
                statusEl.innerText = 'LOW BALANCE';
                statusEl.classList.add('badge-danger');
            } else if (balance < 1000) {
                statusEl.innerText = 'SUFFICIENT';
                statusEl.classList.add('badge-warning');
            } else {
                statusEl.innerText = 'ACTIVE & HEALTHY';
                statusEl.classList.add('badge-success');
            }
        }

        if (histEl) {
            const hist = Storage.get(Storage.KEYS.RECHARGE_HISTORY, []);
            if (hist.length === 0) {
                histEl.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">No recent transactions.</p>';
            } else {
                histEl.innerHTML = hist.slice(0, 8).map(h => {
                    const isDebit = h.net < 0;
                    const amtLabel = isDebit
                        ? `- ${Utils.formatCurrency(Math.abs(h.net))}`
                        : `+ ${Utils.formatCurrency(h.net)}`;
                    const descLabel = isDebit
                        ? (h.gateway || 'Toll Deduction')
                        : `Recharged via ${h.gateway}`;
                    return `
                    <div class="history-item">
                        <div style="flex:1; min-width:0;">
                            <div class="history-amount ${isDebit ? 'debit' : 'credit'}">${amtLabel}</div>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${descLabel}</div>
                        </div>
                        <div style="font-size:10px; color:var(--text-muted); text-align:right; flex-shrink:0;">${Utils.formatDateTime(h.date)}</div>
                    </div>`;
                }).join('');
            }
        }
    },

    deductSummaryToll: (cost, desc) => {
        let balance = Storage.get(Storage.KEYS.FASTAG_BALANCE, 0);
        if (balance < cost) {
            Utils.showToast("INSUFFICIENT FASTAG BALANCE!", "error");
            return false;
        }
        balance -= cost;
        Storage.set(Storage.KEYS.FASTAG_BALANCE, balance);

        // Add to history
        const history = Storage.get(Storage.KEYS.RECHARGE_HISTORY, []);
        history.unshift({
            id: Utils.generateId('TOL'),
            date: new Date().toISOString(),
            amount: -cost, // negative for deduction
            fee: 0,
            net: -cost,
            gateway: desc // Description goes here
        });
        Storage.set(Storage.KEYS.RECHARGE_HISTORY, history);

        FastagEngine.updateUI();
        Utils.showToast(`Toll ${Utils.formatCurrency(cost)} deducted via FASTag.`);
        return true;
    }
};

window.FastagEngine = FastagEngine;
