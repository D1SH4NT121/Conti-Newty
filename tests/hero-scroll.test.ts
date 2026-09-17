import fs from 'fs';
import path from 'path';

describe('Phase 1: Rebuilt Scroll-Driven Hero Section Verification', () => {
  const indexPath = path.resolve(__dirname, '../public/index.html');
  const htmlContent = fs.readFileSync(indexPath, 'utf-8');

  describe('Section Isolation & Preservation', () => {
    test('Hero section exists with pinned viewport and scroll spacer', () => {
      expect(htmlContent).toContain('id="hero-simulation"');
      expect(htmlContent).toContain('id="hero-scroll-spacer"');
      expect(htmlContent).toContain('sticky top-14');
    });

    test('Preserves existing core messaging and typography without alteration', () => {
      expect(htmlContent).toContain('ORGANIZATIONAL CONTINUITY ENGINE');
      expect(htmlContent).toContain('Your company already<br/>has a brain.');
      expect(htmlContent).toContain(
        'Your knowledge already exists across runbooks, retros, and operational markdown.'
      );
      expect(htmlContent).toContain('[ ASK YOUR COMPANY → ]');
      expect(htmlContent).toContain('[ SEE HOW IT WORKS ↓ ]');
      expect(htmlContent).toContain('href="/workbench"');
      expect(htmlContent).toContain('href="#transformation"');
    });

    test('Untouched sections: Navbar, Transformation, Reasoning Moment, Provenance, Surfaces, Multiplayer, Enclave, Telemetry, Footer remain intact', () => {
      expect(htmlContent).toContain('id="transformation"');
      expect(htmlContent).toContain('id="reasoning-moment"');
      expect(htmlContent).toContain('id="provenance-demo"');
      expect(htmlContent).toContain('id="surfaces-suite"');
      expect(htmlContent).toContain('id="multiplayer-canvas"');
      expect(htmlContent).toContain('id="enclave-security"');
      expect(htmlContent).toContain('CONTI-NEWTY');
    });
  });

  describe('Hero 7-State Architecture Elements', () => {
    test('Contains Directory Discovery elements', () => {
      expect(htmlContent).toContain('id="tree-item-prompts"');
      expect(htmlContent).toContain('id="tree-item-docs"');
      expect(htmlContent).toContain('id="tree-sub-target"');
      expect(htmlContent).toContain('chicago_project_review.md');
      expect(htmlContent).toContain('id="tree-item-sops"');
      expect(htmlContent).toContain('id="tree-item-telemetry"');
    });

    test('Contains Realistic Document Viewer with numbered lines 11–24', () => {
      expect(htmlContent).toContain('id="hero-doc-highlight"');
      expect(htmlContent).toContain('Measured Ingestion &amp; Query Gains:');
      expect(htmlContent).toContain('Route deviation lookups: 14 min → 18 seconds.');
      expect(htmlContent).toContain('id="hero-doc-status"');
      expect(htmlContent).toContain('id="hero-doc-idle-placeholder"');
    });

    test('Contains Deterministic Agent Traversal panel with all 5 operations', () => {
      expect(htmlContent).toContain('01 // QUERY INTAKE');
      expect(htmlContent).toContain('LIST DIRECTORY: /docs');
      expect(htmlContent).toContain('OPEN /docs/chicago_project_review.md');
      expect(htmlContent).toContain('READ LINES 14–22');
      expect(htmlContent).toContain('ATTEST SOURCE VERBATIM (SHA-256)');
    });

    test('Contains Provenance and Verified Answer card (State 6 & 7)', () => {
      expect(htmlContent).toContain('id="step-box-answer"');
      expect(htmlContent).toContain('07 // VERIFIED ANSWER');
      expect(htmlContent).toContain('18 seconds');
      expect(htmlContent).toContain('docs/chicago_project_review.md:14–22');
      expect(htmlContent).toContain('100% MATCH');
    });

    test('Contains 7 manual step scrub buttons and progress ticks', () => {
      for (let i = 1; i <= 7; i++) {
        expect(htmlContent).toContain(`data-target-step="${i}"`);
        expect(htmlContent).toContain(`data-tick="${i}"`);
      }
      expect(htmlContent).toContain('id="hero-footer-step-num"');
    });
  });

  describe('Hero Engine Script Logic', () => {
    test('Contains 7 distinct state configurations in JavaScript engine', () => {
      expect(htmlContent).toContain('STATE 01 // IDLE / COMPANY BRAIN');
      expect(htmlContent).toContain('STATE 02 // QUERY INTAKE');
      expect(htmlContent).toContain('STATE 03 // DIRECTORY DISCOVERY');
      expect(htmlContent).toContain('STATE 04 // SOURCE OPENED');
      expect(htmlContent).toContain('STATE 05 // AGENT TRAVERSAL');
      expect(htmlContent).toContain('STATE 06 // PROVENANCE VERIFIED');
      expect(htmlContent).toContain('STATE 07 // VERIFIED ANSWER');
    });

    test('Supports prefers-reduced-motion accessibility', () => {
      expect(htmlContent).toContain('prefers-reduced-motion');
    });

    test('Supports scroll event listener and smooth scrolling scrubber', () => {
      expect(htmlContent).toContain("window.addEventListener('scroll'");
      expect(htmlContent).toContain('renderHeroState');
    });
  });
});
