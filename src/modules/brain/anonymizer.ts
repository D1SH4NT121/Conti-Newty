export interface RedactionRecord {
  type: 'EMAIL' | 'PHONE' | 'FINANCIAL' | 'SECRET' | 'ENTITY';
  original: string;
  redacted: string;
  count: number;
}

export interface AnonymizationResult {
  sanitizedText: string;
  redactions: RedactionRecord[];
  totalRedactions: number;
}

export class DataAnonymizer {
  /**
   * Sanitizes sensitive information from content before external sharing.
   */
  public static anonymize(
    content: string,
    options?: {
      customEntities?: string[];
      maskFinancials?: boolean;
    }
  ): AnonymizationResult {
    let sanitized = content;
    const redactionMap = new Map<string, RedactionRecord>();

    const recordRedaction = (type: RedactionRecord['type'], original: string, redacted: string) => {
      const key = `${type}:${original}`;
      if (redactionMap.has(key)) {
        redactionMap.get(key)!.count++;
      } else {
        redactionMap.set(key, { type, original, redacted, count: 1 });
      }
    };

    // 1. Redact Secret Keys & Tokens (Bearer tokens, api keys)
    const secretRegex = /\b(?:sk-[a-zA-Z0-9_-]{16,}|Bearer\s+[a-zA-Z0-9_.-]{20,}|ghp_[a-zA-Z0-9]{20,})\b/g;
    sanitized = sanitized.replace(secretRegex, (match) => {
      const redacted = '[REDACTED_SECRET_KEY]';
      recordRedaction('SECRET', match, redacted);
      return redacted;
    });

    // 2. Redact Email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
    let emailIndex = 1;
    const emailIndexMap = new Map<string, string>();
    sanitized = sanitized.replace(emailRegex, (match) => {
      if (!emailIndexMap.has(match)) {
        emailIndexMap.set(match, `[CONTACT_EMAIL_${emailIndex++}]`);
      }
      const redacted = emailIndexMap.get(match)!;
      recordRedaction('EMAIL', match, redacted);
      return redacted;
    });

    // 3. Redact Phone numbers
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    sanitized = sanitized.replace(phoneRegex, (match) => {
      const redacted = '[REDACTED_PHONE]';
      recordRedaction('PHONE', match, redacted);
      return redacted;
    });

    // 4. Redact Financial amounts ($X, $XM, $k, etc.) if enabled (default true)
    if (options?.maskFinancials !== false) {
      const financialRegex = /\$\s?\d+(?:,\d{3})*(?:\.\d+)?(?:\s?(?:million|billion|k|M|B|month|yr|year))?/gi;
      sanitized = sanitized.replace(financialRegex, (match) => {
        const redacted = '[FINANCIAL_METRIC]';
        recordRedaction('FINANCIAL', match, redacted);
        return redacted;
      });
    }

    // 5. Redact Custom Entities / Client names
    if (options?.customEntities && options.customEntities.length > 0) {
      for (const entity of options.customEntities) {
        if (!entity || entity.trim().length === 0) continue;
        const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const entityRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
        sanitized = sanitized.replace(entityRegex, (match) => {
          const redacted = '[CONFIDENTIAL_PARTNER]';
          recordRedaction('ENTITY', match, redacted);
          return redacted;
        });
      }
    }

    const redactions = Array.from(redactionMap.values());
    const totalRedactions = redactions.reduce((sum, r) => sum + r.count, 0);

    return {
      sanitizedText: sanitized,
      redactions,
      totalRedactions
    };
  }

  /**
   * Generates a sanitized markdown summary with disclaimer and redaction summary.
   */
  public static generateSanitizedReport(
    originalMarkdown: string,
    options?: {
      customEntities?: string[];
      title?: string;
    }
  ): string {
    const { sanitizedText, totalRedactions } = this.anonymize(originalMarkdown, options);

    const reportHeader = `> **Confidential Document - Anonymized for External Sharing**  
> Sanitized by Conti-Newty Company Brain with ${totalRedactions} sensitive data points redacted.

---

`;

    return reportHeader + sanitizedText;
  }
}
