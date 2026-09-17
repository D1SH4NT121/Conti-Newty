/**
 * Conti-Newty Living Product Interface & Animated System
 * Cohesive state machine connecting the Filesystem, Navigation Agent,
 * Document Viewer, Provenance Citations, and Security Sandbox.
 */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ==========================================================================
  // 1. NEURAL KNOWLEDGE MESH CANVAS (Interactive Constellation)
  // ==========================================================================
  class NeuralMeshCanvas {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.nodes = [];
      this.nodeCount = window.innerWidth < 768 ? 20 : 44;
      this.mouse = { x: -1000, y: -1000, radius: 130 };
      this.labels = ['prompts/', 'docs/', 'sops/', 'notes/', 'operations/', 'escalation.md', 'runway.md', 'chicago_depot.md'];

      this.init();
    }

    init() {
      this.resize();
      window.addEventListener('resize', () => this.resize());
      
      const parent = this.canvas.parentElement;
      if (parent) {
        parent.addEventListener('mousemove', (e) => {
          const rect = this.canvas.getBoundingClientRect();
          this.mouse.x = e.clientX - rect.left;
          this.mouse.y = e.clientY - rect.top;
        });
        parent.addEventListener('mouseleave', () => {
          this.mouse.x = -1000;
          this.mouse.y = -1000;
        });
      }

      for (let i = 0; i < this.nodeCount; i++) {
        const label = i < this.labels.length ? this.labels[i] : null;
        this.nodes.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: label ? 3 : 1.8,
          label: label,
          color: label ? '#8A5F35' : '#B7ADA4',
          pulse: Math.random() * Math.PI
        });
      }

      if (!prefersReducedMotion) {
        this.animate();
      } else {
        this.drawStatic();
      }
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.width = this.canvas.width = rect.width || window.innerWidth;
      this.height = this.canvas.height = rect.height || 420;
    }

    drawStatic() {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.nodes.forEach(node => {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = node.color;
        this.ctx.fill();
      });
    }

    animate() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const dx = this.nodes[i].x - this.nodes[j].x;
          const dy = this.nodes[i].y - this.nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 105) {
            const alpha = (1 - dist / 105) * 0.18;
            this.ctx.strokeStyle = `rgba(138, 95, 53, ${alpha})`;
            this.ctx.lineWidth = 0.7;
            this.ctx.beginPath();
            this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
            this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
            this.ctx.stroke();
          }
        }
      }

      this.nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > this.width) node.vx *= -1;
        if (node.y < 0 || node.y > this.height) node.vy *= -1;

        const dx = this.mouse.x - node.x;
        const dy = this.mouse.y - node.y;
        const mouseDist = Math.sqrt(dx * dx + dy * dy);
        if (mouseDist < this.mouse.radius) {
          const force = (1 - mouseDist / this.mouse.radius) * 0.6;
          node.x += (dx / mouseDist) * force;
          node.y += (dy / mouseDist) * force;
        }

        this.ctx.beginPath();
        node.pulse += 0.025;
        const currentRadius = node.label ? node.radius + Math.sin(node.pulse) * 0.5 : node.radius;
        this.ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = node.color;
        this.ctx.fill();

        if (node.label && mouseDist < 150) {
          this.ctx.font = '9px "IBM Plex Mono", monospace';
          this.ctx.fillStyle = 'rgba(138, 95, 53, 0.9)';
          this.ctx.fillText(node.label, node.x + 7, node.y + 3);
        }
      });

      requestAnimationFrame(() => this.animate());
    }
  }

  // ==========================================================================
  // 2. TEXT DECRYPT / SCRAMBLE REVEAL
  // ==========================================================================
  class TextScrambler {
    constructor(el, options = {}) {
      this.el = el;
      this.chars = '!<>-_\\/[]{}—=+*^?#________';
      this.finalText = el.getAttribute('data-scramble') || el.innerText;
      this.duration = options.duration || 500;
      this.frame = 0;
      this.totalFrames = Math.round(this.duration / 30);
      this.isAnimating = false;
    }

    scramble() {
      if (this.isAnimating) return;
      this.isAnimating = true;
      this.frame = 0;

      const update = () => {
        let output = '';
        const progress = this.frame / this.totalFrames;

        for (let i = 0; i < this.finalText.length; i++) {
          if (i < this.finalText.length * progress) {
            output += this.finalText[i];
          } else {
            output += this.chars[Math.floor(Math.random() * this.chars.length)];
          }
        }

        this.el.innerText = output;
        this.frame++;

        if (this.frame <= this.totalFrames) {
          setTimeout(update, 30);
        } else {
          this.el.innerText = this.finalText;
          this.isAnimating = false;
        }
      };

      update();
    }
  }

  // ==========================================================================
  // 3. SPOTLIGHT CARDS (Cursor tracking & 3D Tilt)
  // ==========================================================================
  function setupSpotlightCards() {
    const cards = document.querySelectorAll('.spotlight-card');
    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);

        if (!prefersReducedMotion && card.classList.contains('tilt-card')) {
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -2.5;
          const rotateY = ((x - centerX) / centerX) * 2.5;
          card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        }
      });

      card.addEventListener('mouseleave', () => {
        card.style.removeProperty('--mouse-x');
        card.style.removeProperty('--mouse-y');
        if (card.classList.contains('tilt-card')) {
          card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        }
      });
    });
  }

  // ==========================================================================
  // 4. LIVE MULTIPLAYER CURSORS SIMULATION
  // ==========================================================================
  function setupMultiplayerCursors() {
    const container = document.getElementById('workbench-preview');
    if (!container || prefersReducedMotion) return;

    const cursors = [
      { id: 'cursor-alex', name: 'Alex Rivera', role: 'Editing SOP', color: '#10B981', x: 270, y: 130 },
      { id: 'cursor-maya', name: 'Maya Lin', role: 'Querying Brain', color: '#8A5F35', x: 590, y: 310 },
      { id: 'cursor-ai', name: 'Navigation Agent', role: 'Scanning /docs', color: '#5D2A30', x: 130, y: 210 }
    ];

    const cursorElements = cursors.map(c => {
      const el = document.createElement('div');
      el.className = 'live-peer-cursor';
      el.id = c.id;
      el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="${c.color}">
          <path d="M0 0l5.5 14 2.5-5 5.5-2.5L0 0z" />
        </svg>
        <span class="cursor-tag" style="background:${c.color};">${c.name} <small>• ${c.role}</small></span>
      `;
      container.appendChild(el);
      return { ...c, el };
    });

    let t = 0;
    function animateCursors() {
      t += 0.012;
      cursorElements.forEach((c, idx) => {
        const offset = idx * 2.1;
        const currentX = c.x + Math.sin(t + offset) * 75 + Math.cos(t * 0.6 + offset) * 30;
        const currentY = c.y + Math.cos(t * 0.7 + offset) * 50 + Math.sin(t * 0.4) * 18;
        c.el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      });
      requestAnimationFrame(animateCursors);
    }

    animateCursors();
  }

  // ==========================================================================
  // 5. UNIFIED COMPANY BRAIN SYSTEM (The Coordinated State Machine)
  // ==========================================================================
  window.CompanyBrainSystem = {
    states: ['IDLE', 'QUERY_RECEIVED', 'NAVIGATING', 'SEARCHING', 'READING', 'VERIFYING', 'ANSWERING', 'SOURCE_LINKED'],

    scenarios: {
      chicago: {
        id: 'chicago',
        name: 'Chicago Depot SLA Metrics',
        query: 'What was the measured efficiency gain in our Chicago depot deployment?',
        docPath: '/docs/chicago_project_review.md',
        activeTreeId: 'tree-chicago',
        gutterLines: [14, 15, 16, 17, 18, 19, 20, 21, 22],
        highlightLines: [17, 18, 19],
        title: 'Chicago Logistics Depot Pilot Review',
        content: `
          <p>
            <strong>Partner:</strong> Midwest Logistics Syndicate (Chicago, IL).<br>
            <strong>Deployment:</strong> Isolated Docker containers across 12 depot operations.<br>
            <strong>Outcomes:</strong> Replaced 40-page PDF binders with queryable ICM folder structures.
          </p>
          <p class="mock-line-target" data-lines="17-19">
            Dispatcher lookup latency decreased from 14 minutes to 18 seconds. As verified in <span class="citation-link" data-scenario="chicago">[source: sops/client_onboarding.md:14-22]</span>, client stakeholders queried depot statuses directly without multi-agent routing bottlenecks.
          </p>
          <blockquote style="margin-top: 1rem; border-left: 2px solid var(--earth-ochre); padding-left: 1rem; font-style: italic; color: var(--ink-secondary);">
            "Operational dispatchers preferred direct natural language queries with clickable file citations over complex multi-agent dashboards."
          </blockquote>
        `,
        editorNote: 'Alex Rivera (editing line 19)',
        diffBadge: '+18s benchmark verified',
        steps: [
          '> QUERY_RECEIVED: "What was the measured efficiency gain in our Chicago depot deployment?"',
          '> NAVIGATING: Directory /docs',
          '  ├── /docs/company_overview.md',
          '  ├── /docs/fundraising_status.md',
          '  └── /docs/chicago_project_review.md [RELEVANCE 98%]',
          '> READING: /docs/chicago_project_review.md (lines 14–22)',
          '> VERIFYING: Epistemic line hash checked against disk [MATCH]',
          '> ANSWER READY: 18-second SLA improvement confirmed'
        ],
        answer: 'The Chicago logistics pilot reduced dispatcher lookup latency from 14 minutes down to 18 seconds across 12 depots. Operational dispatchers queried depot statuses directly without multi-agent routing bottlenecks.',
        citation: 'docs/chicago_project_review.md:14-22'
      },

      escalation: {
        id: 'escalation',
        name: 'Depot SLA Breach Escalation',
        query: 'What is the escalation procedure for a Chicago depot SLA breach?',
        docPath: '/sops/production_deployment.md',
        activeTreeId: 'tree-deployment',
        gutterLines: [40, 41, 42, 43, 44, 45, 46, 47, 48],
        highlightLines: [42, 43, 44, 45],
        title: 'Enterprise Freight Delay & Failover SOP',
        content: `
          <p>
            <strong>Classification:</strong> Tier-1 Critical Route Delay Escalation Protocol.<br>
            <strong>Trigger:</strong> Any intermodal depot bottleneck exceeding 45 minutes without telematics heartbeat.
          </p>
          <p class="mock-line-target" data-lines="42-45">
            <strong>Mandatory Protocol:</strong> Escalate directly to the regional operations lead within 15 minutes of telematics breach confirmation. Automated secondary carrier pool failover is triggered simultaneously.
          </p>
          <p>
            All audit logs stream to the active workbench as defined in <span class="citation-link" data-scenario="escalation">[source: sops/production_deployment.md:42-48]</span>.
          </p>
        `,
        editorNote: 'Sarah Chen (reviewing line 44)',
        diffBadge: '15m SLA locked',
        steps: [
          '> QUERY_RECEIVED: "What is the escalation procedure for a Chicago depot SLA breach?"',
          '> NAVIGATING: Directory /sops',
          '  ├── /sops/client_onboarding.md',
          '  └── /sops/production_deployment.md [RELEVANCE 95%]',
          '> READING: /sops/production_deployment.md (lines 42–48)',
          '> VERIFYING: Escalation SLA validated against operational handbook [CONFIRMED]',
          '> ANSWER READY: Protocol requires lead notification in 15m'
        ],
        answer: 'Escalate to the regional operations lead within 15 minutes of telematics breach confirmation. Automated failover dispatch occurs simultaneously to secondary carrier pools.',
        citation: 'sops/production_deployment.md:42-48'
      },

      runway: {
        id: 'runway',
        name: 'Capital & Operating Runway',
        query: 'What is our current committed capital and operational runway?',
        docPath: '/docs/fundraising_status.md',
        activeTreeId: 'tree-fundraising',
        gutterLines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        highlightLines: [6, 7, 8],
        title: 'Financial Plan & Runway Overview',
        content: `
          <p>
            <strong>Committed Capital:</strong> $1.8M in seed extension syndicate.<br>
            <strong>Monthly Cash Burn:</strong> $65,000 / month across engineering & cloud containers.<br>
            <strong>Current Runway:</strong> 18 months of operational security.
          </p>
          <p class="mock-line-target" data-lines="6-8">
            Data anonymization engine active: proprietary investor entities are automatically redacted before client-facing workbench exports as verified in <span class="citation-link" data-scenario="runway">[source: docs/fundraising_status.md:6-12]</span>.
          </p>
        `,
        editorNote: 'Maya Lin (scrubbing line 7)',
        diffBadge: 'PII Protected',
        steps: [
          '> QUERY_RECEIVED: "What is our current committed capital and operational runway?"',
          '> NAVIGATING: Directory /docs',
          '  └── /docs/fundraising_status.md [RELEVANCE 99%]',
          '> READING: /docs/fundraising_status.md (lines 6–12)',
          '> VERIFYING: Data anonymization engine scrubbed private investor identities [CLEAN]',
          '> ANSWER READY: 18 months runway at $65k/month burn verified'
        ],
        answer: 'Current cash burn is $65k/month with $1.8M committed in the seed round, providing 18 months of operational runway with zero external dependencies.',
        citation: 'docs/fundraising_status.md:6-12'
      }
    },

    activeScenario: null,
    isExecuting: false,

    run(scenarioKey) {
      if (this.isExecuting) return;
      const scenario = this.scenarios[scenarioKey] || this.scenarios.chicago;
      this.activeScenario = scenarioKey;
      this.isExecuting = true;

      // 1. Update Scenario Buttons everywhere (Hero tabs, Simulator tabs, Use cases)
      document.querySelectorAll('[data-scenario]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-scenario') === scenarioKey);
      });
      document.querySelectorAll('.hero-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === scenarioKey);
      });

      // 2. Animate Agent State Machine in real-time
      const stateSteps = ['QUERY_RECEIVED', 'NAVIGATING', 'SEARCHING', 'READING', 'VERIFYING', 'ANSWERING', 'SOURCE_LINKED'];
      let stepIdx = 0;

      const updateStateDisplay = (st) => {
        document.querySelectorAll('.agent-state-step').forEach(el => {
          const stepName = el.getAttribute('data-step');
          if (stepName === st) {
            el.className = 'agent-state-step active';
          } else if (stateSteps.indexOf(stepName) < stateSteps.indexOf(st)) {
            el.className = 'agent-state-step completed';
          } else {
            el.className = 'agent-state-step';
          }
        });
        const liveBadge = document.getElementById('hero-agent-status');
        if (liveBadge) liveBadge.innerHTML = `<span class="status-dot active"></span> ● ${st.replace('_', ' ')}`;
      };

      // 3. Highlight Folder Tree
      document.querySelectorAll('.mock-tree-item').forEach(item => {
        item.classList.toggle('active', item.id === scenario.activeTreeId);
      });

      // 4. Update Navigation Stepper / Terminal Logs
      const terminal = document.getElementById('simulator-logs');
      if (terminal) terminal.innerHTML = '';
      const queryDisplay = document.getElementById('simulator-query-display');
      if (queryDisplay) queryDisplay.textContent = `"${scenario.query}"`;

      // 5. Update Hero Mockup UI
      const heroQuery = document.getElementById('hero-mock-query');
      if (heroQuery) heroQuery.textContent = scenario.query;
      const heroPath = document.getElementById('hero-mock-doc-path');
      if (heroPath) heroPath.textContent = `Active Document: ${scenario.docPath}`;
      const heroTitle = document.getElementById('hero-mock-doc-title');
      if (heroTitle) heroTitle.textContent = scenario.title;
      const heroBody = document.getElementById('hero-mock-doc-text');
      if (heroBody) heroBody.innerHTML = scenario.content;
      const heroGutter = document.getElementById('hero-mock-gutter');
      if (heroGutter) {
        heroGutter.innerHTML = scenario.gutterLines.map(n => `<div>${n}</div>`).join('');
      }
      const heroCursor = document.getElementById('hero-mock-cursor-line');
      if (heroCursor) {
        heroCursor.innerHTML = `● ${scenario.editorNote} <span class="mock-diff-tag">${scenario.diffBadge}</span>`;
      }

      // Stream log lines and step states
      let logIdx = 0;
      const streamInterval = setInterval(() => {
        if (logIdx < scenario.steps.length) {
          const lineText = scenario.steps[logIdx];
          if (terminal) {
            const lineEl = document.createElement('div');
            lineEl.className = 'sim-log-line' + (lineText.includes('[RELEVANCE') || lineText.includes('[CONFIRMED]') || lineText.includes('[MATCH]') ? ' highlight' : '');
            lineEl.textContent = lineText;
            terminal.appendChild(lineEl);
            terminal.scrollTop = terminal.scrollHeight;
          }

          if (stepIdx < stateSteps.length) {
            updateStateDisplay(stateSteps[stepIdx]);
            stepIdx++;
          }

          logIdx++;
        } else {
          clearInterval(streamInterval);
          updateStateDisplay('SOURCE_LINKED');

          // Flash highlighted lines in the document viewer
          const targetBlock = document.querySelector('.mock-line-target');
          if (targetBlock) {
            targetBlock.classList.add('mock-line-highlight', 'flash');
          }

          // Show answer and citation
          const heroAnswer = document.getElementById('hero-mock-answer');
          if (heroAnswer) {
            heroAnswer.innerHTML = `
              ${scenario.answer}
              <br><br>
              <span class="citation-link" data-scenario="${scenario.id}" tabindex="0">[source: ${scenario.citation}]</span>
            `;
          }

          const simAnswerBox = document.getElementById('simulator-answer-box');
          if (simAnswerBox) {
            const textEl = simAnswerBox.querySelector('.sim-answer-text');
            if (textEl) textEl.textContent = scenario.answer;
            const chip = document.getElementById('simulator-citation-chip');
            if (chip) chip.textContent = `[source: ${scenario.citation}]`;
            simAnswerBox.style.opacity = '1';
          }

          // Provenance section live update
          const provAnswer = document.getElementById('provenance-live-answer');
          if (provAnswer) provAnswer.textContent = `"${scenario.answer}"`;
          const provSource = document.getElementById('provenance-live-source');
          if (provSource) provSource.textContent = `[source: ${scenario.citation}]`;

          this.isExecuting = false;
        }
      }, 140);
    }
  };

  // Keep compatibility alias for existing HTML inline handlers
  window.HarnessSimulator = {
    run: (key) => window.CompanyBrainSystem.run(key)
  };

  // ==========================================================================
  // 6. INTERACTIVE SECURITY SANDBOX SIMULATOR
  // ==========================================================================
  window.InteractiveSecuritySandbox = {
    checks: {
      private: {
        path: '/company/payroll/private.md',
        logs: [
          '> INBOUND_TOOL_REQUEST: READ_FILE /company/payroll/private.md',
          '> AUTHENTICATION: Member (Role: Logistics Operator, Org: Acme)',
          '> STEP 1: PATH NORMALIZATION ... OK',
          '> STEP 2: TRAVERSAL SCAN (/../ check) ... CLEAR',
          '> STEP 3: RBAC POLICY EVALUATION ...',
          '  └── Pattern Match: /company/payroll/* requires [ROLE_FINANCE_ADMIN]',
          '> REJECTION CODE: 403_FORBIDDEN',
          '> OUTCOME: ACCESS DENIED × (User role blocked by kernel sandbox)'
        ],
        statusBadge: '<span class="sec-badge-denied">ACCESS DENIED × (PATH BLOCKED)</span>',
        description: 'Unauthorized access to confidential directories is rejected at the server boundary before any file handle opens.'
      },
      dispatch: {
        path: '/sops/production_deployment.md',
        logs: [
          '> INBOUND_TOOL_REQUEST: READ_FILE /sops/production_deployment.md',
          '> AUTHENTICATION: Member (Role: Logistics Operator, Org: Acme)',
          '> STEP 1: PATH NORMALIZATION ... OK',
          '> STEP 2: CONTAINER ISOLATION BOUNDARY ... VERIFIED (Depot Container #12)',
          '> STEP 3: RBAC POLICY EVALUATION ...',
          '  └── Pattern Match: /sops/* [READ_PERMITTED for MEMBER]',
          '> FILE STREAM: 48 lines read with SHA-256 integrity hash',
          '> OUTCOME: AUTHORIZED ✓ (Provenance stamped with audit ledger)'
        ],
        statusBadge: '<span class="sec-badge-approved">AUTHORIZED ✓ (PROVENANCE LOGGED)</span>',
        description: 'Authorized operational SOPs are safely read within isolated Docker container boundaries with cryptographic logging.'
      }
    },

    runCheck(checkType) {
      const data = this.checks[checkType];
      if (!data) return;

      document.querySelectorAll('.sec-trigger-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-check') === checkType);
      });

      const term = document.getElementById('security-logs');
      const badge = document.getElementById('security-status-badge');
      const desc = document.getElementById('security-status-desc');

      if (badge) badge.innerHTML = data.statusBadge;
      if (desc) desc.textContent = data.description;
      if (term) {
        term.innerHTML = '';
        data.logs.forEach((line, idx) => {
          setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'sim-log-line' + (line.includes('DENIED') ? ' highlight' : line.includes('AUTHORIZED') ? ' highlight' : '');
            if (line.includes('DENIED')) el.style.color = '#F87171';
            if (line.includes('AUTHORIZED')) el.style.color = '#34D399';
            el.textContent = line;
            term.appendChild(el);
            term.scrollTop = term.scrollHeight;
          }, idx * 75);
        });
      }
    }
  };

  // ==========================================================================
  // 7. INTERACTIVE THREE PANELS SWITCHER
  // ==========================================================================
  window.InteractiveThreePanels = {
    select(panelId) {
      document.querySelectorAll('.panel-tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-panel') === panelId);
      });

      document.querySelectorAll('.panel-spotlight-box').forEach(b => {
        const isMatch = b.getAttribute('data-panel-box') === panelId;
        b.classList.toggle('focused', isMatch);
        if (isMatch) {
          b.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }
  };

  // ==========================================================================
  // 8. SCROLL SPY & PROVENANCE CLICKS
  // ==========================================================================
  function setupScrollSpyNav() {
    const navLinks = document.querySelectorAll('.eduba-nav .nav-link');
    if (navLinks.length === 0) return;

    const sections = Array.from(navLinks).map(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        return document.querySelector(href);
      }
      return null;
    }).filter(Boolean);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    sections.forEach(sec => observer.observe(sec));
  }

  function setupProvenanceClicks() {
    document.addEventListener('click', (e) => {
      const citationEl = e.target.closest('.citation-link, .mock-citation, .sim-citation-chip');
      if (citationEl) {
        e.preventDefault();
        const scenarioKey = citationEl.getAttribute('data-scenario') || 'chicago';
        
        // Ensure that scenario is active
        if (window.CompanyBrainSystem.activeScenario !== scenarioKey) {
          window.CompanyBrainSystem.run(scenarioKey);
        }

        // Smooth scroll to hero workbench or provenance section
        const workbench = document.getElementById('workbench-preview');
        if (workbench) {
          workbench.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const targetBlock = workbench.querySelector('.mock-line-target');
          if (targetBlock) {
            targetBlock.classList.remove('flash');
            void targetBlock.offsetWidth; // trigger reflow
            targetBlock.classList.add('flash');
          }
        }
      }
    });
  }

  // ==========================================================================
  // 9. ANIMATED COUNTER UP (Telemetry HUD)
  // ==========================================================================
  function setupAnimatedCounters() {
    const counterElements = document.querySelectorAll('[data-counter]');
    if (counterElements.length === 0) return;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseFloat(el.getAttribute('data-counter'));
          const suffix = el.getAttribute('data-suffix') || '';
          const duration = 1200;
          const startTime = performance.now();

          function updateCounter(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(easeProgress * target);
            el.textContent = `${current}${suffix}`;

            if (progress < 1) {
              requestAnimationFrame(updateCounter);
            } else {
              el.textContent = `${target}${suffix}`;
            }
          }

          requestAnimationFrame(updateCounter);
          obs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    counterElements.forEach(el => observer.observe(el));
  }

  // ==========================================================================
  // 10. MAGNETIC BUTTON PHYSICS
  // ==========================================================================
  function setupMagneticButtons() {
    if (prefersReducedMotion) return;
    const magneticBtns = document.querySelectorAll('.btn-magnetic');

    magneticBtns.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - (rect.left + rect.width / 2);
        const y = e.clientY - (rect.top + rect.height / 2);
        btn.style.transform = `translate3d(${x * 0.22}px, ${y * 0.22}px, 0)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate3d(0, 0, 0)';
      });
    });
  }

  // ==========================================================================
  // 13. EDUBA.IO FANNED STACK & FOLDER TAB LOGIC
  // ==========================================================================
  class FannedReviewsStack {
    constructor() {
      this.btn = document.querySelector('.fan-rotary-btn');
      this.cards = Array.from(document.querySelectorAll('.fanned-card'));
      if (!this.cards.length) return;

      this.currentIndex = 0;
      this.init();
    }

    init() {
      this.updateClasses();
      if (this.btn) {
        this.btn.addEventListener('click', () => {
          this.currentIndex = (this.currentIndex + 1) % this.cards.length;
          this.updateClasses();
        });
      }
    }

    updateClasses() {
      this.cards.forEach((card, idx) => {
        card.classList.remove('active', 'stack-back-1', 'stack-back-2');
        if (idx === this.currentIndex) {
          card.classList.add('active');
        } else if (idx === (this.currentIndex + 1) % this.cards.length) {
          card.classList.add('stack-back-1');
        } else if (idx === (this.currentIndex + 2) % this.cards.length) {
          card.classList.add('stack-back-2');
        }
      });
    }
  }

  function setupFolderTabs() {
    const headers = document.querySelectorAll('.folder-tab-header');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.folder-tab-card');
        const container = card.closest('.folder-tab-container');
        if (container) {
          container.querySelectorAll('.folder-tab-card').forEach(c => c.classList.remove('active'));
        }
        card.classList.add('active');
      });
    });
  }

  // ==========================================================================
  // INITIALIZE ON DOM READY
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Canvas Mesh
    new NeuralMeshCanvas('hero-mesh-canvas');

    // 2. Scramble Text
    document.querySelectorAll('.scramble-text').forEach(el => {
      const scrambler = new TextScrambler(el);
      el.addEventListener('mouseenter', () => scrambler.scramble());
      setTimeout(() => scrambler.scramble(), 350);
    });

    // 3. Spotlight Cards
    setupSpotlightCards();

    // 4. Multiplayer Cursors
    setupMultiplayerCursors();

    // 5. Initial Run of Company Brain System
    if (window.CompanyBrainSystem) {
      window.CompanyBrainSystem.run('chicago');
    }

    // 6. Initial Run of Security Sandbox
    if (window.InteractiveSecuritySandbox) {
      window.InteractiveSecuritySandbox.runCheck('dispatch');
    }

    // 7. Interactive Triggers
    document.querySelectorAll('.hero-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const key = tab.getAttribute('data-tab');
        if (key && window.CompanyBrainSystem) window.CompanyBrainSystem.run(key);
      });
    });

    document.querySelectorAll('[data-scenario]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-scenario');
        if (key && window.CompanyBrainSystem) window.CompanyBrainSystem.run(key);
      });
    });

    document.querySelectorAll('.panel-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.getAttribute('data-panel');
        if (panel && window.InteractiveThreePanels) window.InteractiveThreePanels.select(panel);
      });
    });

    document.querySelectorAll('.sec-trigger-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const checkType = btn.getAttribute('data-check');
        if (checkType && window.InteractiveSecuritySandbox) window.InteractiveSecuritySandbox.runCheck(checkType);
      });
    });

    // Custom query input in hero
    const queryInput = document.getElementById('hero-user-query-input');
    const querySubmit = document.getElementById('hero-user-query-submit');
    if (queryInput && querySubmit) {
      const handleCustom = () => {
        const val = queryInput.value.trim().toLowerCase();
        if (val.includes('sla') || val.includes('depot') || val.includes('chicago')) {
          window.CompanyBrainSystem.run('chicago');
        } else if (val.includes('delay') || val.includes('escalat') || val.includes('sop')) {
          window.CompanyBrainSystem.run('escalation');
        } else if (val.includes('burn') || val.includes('runway') || val.includes('money') || val.includes('cash')) {
          window.CompanyBrainSystem.run('runway');
        } else {
          window.CompanyBrainSystem.run('chicago');
        }
      };

      querySubmit.addEventListener('click', handleCustom);
      queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCustom();
      });
    }

    // 8. Scroll Spy & Provenance Clicks
    setupScrollSpyNav();
    setupProvenanceClicks();

    // 9. Animated Counters
    setupAnimatedCounters();

    // 10. Magnetic Buttons
    setupMagneticButtons();

    // 11. Eduba-Specific Fanned Reviews Stack & Manila Folder Tabs
    new FannedReviewsStack();
    setupFolderTabs();
  });

})();
