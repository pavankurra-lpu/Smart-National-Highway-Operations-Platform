// Pass Plans Logic

const PassPlanEngine = {
    generateRecommendations: (routeData) => {
        if (!routeData || routeData.tolls.length === 0) {
            return `<div style="text-align:center; padding: 20px; color:var(--text-sec);">No tolls on this route. Pass plans not applicable.</div>`;
        }

        const isExempt = routeData.totalTollCost === 0;
        if (isExempt) {
            return `<div style="text-align:center; padding: 20px; color:var(--primary);">You selected a pre-registered Exempt category. Pass plans not required!</div>`;
        }

        let html = '';
        
        // Single Trip
        html += `
            <div class="plan-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:var(--text-main);">Pay-As-You-Go (Single)</strong>
                    <span style="color:var(--accent-yellow); font-weight:bold;">${Utils.formatCurrency(routeData.totalTollCost)}</span>
                </div>
                <p style="font-size:10px;">Direct FASTag deduction per plaza.</p>
            </div>
        `;

        // Return Trip (usually 1.5x of single)
        const returnCost = Math.floor(routeData.totalTollCost * (TollData.passes.RETURN.multiplier || 1.5));
        html += `
            <div class="plan-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:var(--text-main);">Return Pass (24 Hrs)</strong>
                    <span style="color:var(--primary); font-weight:bold;">${Utils.formatCurrency(returnCost)}</span>
                </div>
                <p style="font-size:10px;">Valid for return journey within 24 hours.</p>
            </div>
        `;

        // NHAI Annual Pass (for LMV only)
        if (routeData.vehicleType === 'LMV') {
            html += `
                <div class="plan-card" style="border-color: rgba(0, 229, 179, 0.4); background: rgba(0, 229, 179, 0.05);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <strong style="color:var(--primary);">Annual Pass (FY 2026-27)</strong>
                        <span style="color:#fff; font-weight:bold;">${Utils.formatCurrency(TollData.passes.ANNUAL_NH.price)}</span>
                    </div>
                    <p style="font-size:10px;">Valid for 1 year or 200 transactions across all NH plazas.</p>
                </div>
            `;
            
            html += `
                <div class="plan-card" style="border-color: rgba(252, 211, 77, 0.4);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <strong style="color:var(--accent-yellow);">Monthly Pass (Local Plaza)</strong>
                        <span style="color:#fff; font-weight:bold;">${Utils.formatCurrency(TollData.passes.MONTHLY_LOCAL.price)}</span>
                    </div>
                    <p style="font-size:10px;">For residents within 20km of a specific plaza.</p>
                </div>
            `;
        }

        // Monthly Sim (Plaza specific max)
        const monthlyCost = Math.floor(routeData.totalTollCost * (TollData.passes.MONTHLY_PLAZA.multiplier || 33));
        html += `
            <div class="plan-card" style="border-color: rgba(59, 130, 246, 0.5);">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:#3b82f6;">Monthly Plaza Pass (Standard)</strong>
                    <span style="color:#fff; font-weight:bold;">${Utils.formatCurrency(monthlyCost)}</span>
                </div>
                <p style="font-size:10px;">Unlimited trips for the selected route plazas for 30 days.</p>
            </div>
        `;

        if (routeData.vehicleType === 'LMV') {
            html += `
                <div style="margin-top: 10px; font-size:10px; color:var(--text-sec); border-top:1px dashed var(--border); padding-top:10px;">
                    * All pass prices are based on NHAI FY 2026-27 schedules. Eligibility for local pass requires address proof.
                </div>
            `;
        } else {
            html += `
                <div style="margin-top: 10px; font-size:10px; color:var(--text-sec); border-top:1px dashed var(--border); padding-top:10px;">
                    * Commercial heavy vehicles are subject to overload checks. Annual passes are for private vehicles only.
                </div>
            `;
        }

        return html;
    }
};

window.PassPlanEngine = PassPlanEngine;
