import React, { useState } from 'react';
import { InView } from '../motion/InView';

interface PricingSectionProps {
  onSelectTier?: (tier: string) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onSelectTier }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const tiers = [
    {
      name: 'DEVELOPER',
      desc: 'Local git-backed knowledge graph for individual builders.',
      priceMonthly: '$0',
      priceAnnual: '$0',
      period: 'forever free',
      highlight: false,
      cta: 'START LOCAL GRAPH',
      features: [
        'Up to 1,000 Markdown documents',
        'Local Git repo synchronization',
        'CLI traversal & reasoning agent',
        'SHA-256 step verification',
        'Community Discord access',
      ],
    },
    {
      name: 'TEAM',
      desc: 'Collaborative Company Brain for fast-moving engineering teams.',
      priceMonthly: '$40',
      priceAnnual: '$32',
      period: 'per seat / month',
      highlight: true, // Recommended with subtle accent border
      cta: 'START 14-DAY TRIAL',
      badge: 'RECOMMENDED',
      features: [
        'Unlimited git-mounted documents',
        'Realtime multiplayer collaboration',
        'Slack, Drive, GitHub, Jira sync bridges',
        'Deterministic AST grep & AST indexing',
        'Automated PR & incident analysis',
        'Granular role-based permissions',
      ],
    },
    {
      name: 'ENTERPRISE',
      desc: 'Isolated enclave deployment with cryptographic audit guarantees.',
      priceMonthly: 'Custom',
      priceAnnual: 'Custom',
      period: 'tailored SLA',
      highlight: false,
      cta: 'TALK TO AN ARCHITECT',
      features: [
        'Isolated customer VPC / Enclave',
        'SAML 2.0 & Okta SSO integration',
        'Zero Data Retention compliance',
        'Cryptographic audit ledger export',
        'Dedicated Solutions Architect',
        '99.99% Uptime SLA guarantee',
      ],
    },
  ];

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto relative z-10" id="pricing">
      <InView>
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
            TRANSPARENT PRICING
          </p>
          <h2 className="font-serif text-4xl lg:text-5xl font-light leading-tight text-foreground mb-4">
            Zero lock-in pricing.<br />
            <em>Predictable at every scale.</em>
          </h2>
          <p className="text-muted-foreground text-sm">
            Own your data in git. No per-token price shocks or proprietary vector DB hosting markups.
          </p>

          {/* Billing Switch */}
          <div className="flex items-center justify-center gap-3 mt-8 font-mono text-xs">
            <span className={billingCycle === 'monthly' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'annual' ? 'monthly' : 'annual')}
              className="w-12 h-6 rounded-full bg-secondary border border-border p-0.5 flex items-center transition-colors"
            >
              <div
                className={`w-5 h-5 rounded-full bg-primary transition-transform ${
                  billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={billingCycle === 'annual' ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
              Annual <span className="text-[10px] text-primary font-bold">(Save 20%)</span>
            </span>
          </div>
        </div>
      </InView>

      {/* 3-Tier Pricing Grid */}
      <div className="grid md:grid-cols-3 gap-8 items-stretch">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`p-8 rounded-md bg-card flex flex-col justify-between transition-all duration-300 relative ${
              tier.highlight
                ? 'border-2 border-primary shadow-md ring-1 ring-primary/20'
                : 'border border-border shadow-xs hover:border-foreground/30'
            }`}
          >
            {tier.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-wider px-3 py-0.5 bg-primary text-primary-foreground font-bold rounded-full">
                {tier.badge}
              </span>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-sm font-semibold tracking-wider text-foreground">
                  {tier.name}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-6 min-h-[36px]">
                {tier.desc}
              </p>

              <div className="mb-6 pb-6 border-b border-border">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-4xl font-bold text-foreground">
                    {billingCycle === 'annual' ? tier.priceAnnual : tier.priceMonthly}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{tier.period}</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="space-y-3 mb-8 font-mono text-xs">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="text-primary font-bold">✓</span>
                    <span className="text-foreground/90">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onSelectTier && onSelectTier(tier.name)}
              className={`w-full py-3 px-4 font-mono text-xs tracking-wider rounded transition-colors font-semibold ${
                tier.highlight
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                  : 'bg-secondary text-foreground hover:bg-foreground hover:text-background border border-border'
              }`}
            >
              {tier.cta} →
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
