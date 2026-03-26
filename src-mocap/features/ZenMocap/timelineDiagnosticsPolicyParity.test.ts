import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FALLBACK_TIMELINE_DIAGNOSTICS_POLICY } from './timelineDiagnosticsFallbackPolicy';

const POLICY_MANIFEST_PATH = resolve(
  process.cwd(),
  'crates/zen-mocap-engine/resources/timeline_runtime_diagnostics_policy.toml',
);

function parseQuotedValues(input: string): string[] {
  return [...input.matchAll(/"([^"]+)"/g)].map(match => match[1]);
}

function parseAllowedReasons(manifestToml: string): string[] {
  const match = manifestToml.match(/allowed_reasons\s*=\s*\[([\s\S]*?)\]/);
  if (!match) {
    throw new Error('timeline runtime diagnostics policy manifest is missing event.allowed_reasons');
  }
  return parseQuotedValues(match[1]);
}

function parseReasonCatalogIds(manifestToml: string): string[] {
  return [...manifestToml.matchAll(/reason_id\s*=\s*"([^"]+)"/g)].map(match => match[1]);
}

function parseTrendReasonThresholds(manifestToml: string): Array<{
  reason_id: string;
  warn_count: number;
  error_count: number;
  warn_action_hint?: string;
  error_action_hint?: string;
}> {
  const blocks = manifestToml.split('[[trend.reason_thresholds]]').slice(1);
  return blocks.map(block => {
    const reasonIdMatch = block.match(/reason_id\s*=\s*"([^"]+)"/);
    const warnCountMatch = block.match(/warn_count\s*=\s*(\d+)/);
    const errorCountMatch = block.match(/error_count\s*=\s*(\d+)/);
    const warnActionHintMatch = block.match(/warn_action_hint\s*=\s*"([^"]+)"/);
    const errorActionHintMatch = block.match(/error_action_hint\s*=\s*"([^"]+)"/);
    if (!reasonIdMatch || !warnCountMatch || !errorCountMatch) {
      throw new Error('invalid trend.reason_thresholds block in timeline diagnostics policy manifest');
    }
    return {
      reason_id: reasonIdMatch[1],
      warn_count: Number(warnCountMatch[1]),
      error_count: Number(errorCountMatch[1]),
      warn_action_hint: warnActionHintMatch?.[1],
      error_action_hint: errorActionHintMatch?.[1],
    };
  });
}

function parseIntegerField(manifestToml: string, key: string): number {
  const escapedKey = key.replaceAll('.', '\\.');
  const match = manifestToml.match(new RegExp(`${escapedKey}\\s*=\\s*(\\d+)`));
  if (!match) {
    throw new Error(`timeline runtime diagnostics policy manifest is missing '${key}'`);
  }
  return Number(match[1]);
}

function parseBooleanField(manifestToml: string, key: string): boolean {
  const escapedKey = key.replaceAll('.', '\\.');
  const match = manifestToml.match(new RegExp(`${escapedKey}\\s*=\\s*(true|false)`));
  if (!match) {
    throw new Error(`timeline runtime diagnostics policy manifest is missing '${key}'`);
  }
  return match[1] === 'true';
}

function parseStringField(manifestToml: string, key: string): string {
  const escapedKey = key.replaceAll('.', '\\.');
  const match = manifestToml.match(new RegExp(`${escapedKey}\\s*=\\s*\"([^\"]+)\"`));
  if (!match) {
    throw new Error(`timeline runtime diagnostics policy manifest is missing '${key}'`);
  }
  return match[1];
}

describe('timeline diagnostics fallback policy parity', () => {
  it('keeps fallback reason IDs aligned with engine diagnostics policy manifest', () => {
    const manifestToml = readFileSync(POLICY_MANIFEST_PATH, 'utf8');
    const manifestAllowedReasons = parseAllowedReasons(manifestToml);
    const manifestCatalogReasonIds = parseReasonCatalogIds(manifestToml);
    const manifestReasonHistoryLimit = parseIntegerField(manifestToml, 'reason_history_limit');
    const manifestDecayWindowMs = parseIntegerField(manifestToml, 'decay_window_ms');
    const manifestCooldownWindowMs = parseIntegerField(manifestToml, 'cooldown_window_ms');
    const manifestTopReasonCount = parseIntegerField(manifestToml, 'top_reason_count');
    const manifestEventTrendSummaryTopCount = parseIntegerField(manifestToml, 'trend_summary_top_count');
    const manifestEventTrendSummaryMinSeverity = parseStringField(manifestToml, 'trend_summary_min_severity');
    const manifestDefaultWarnCount = parseIntegerField(manifestToml, 'default_warn_count');
    const manifestDefaultErrorCount = parseIntegerField(manifestToml, 'default_error_count');
    const manifestTrendReasonThresholds = parseTrendReasonThresholds(manifestToml);
    const manifestShowRecentReasonCounts = parseBooleanField(
      manifestToml,
      'show_recent_reason_counts',
    );
    const manifestIncludeTrendSummary = parseBooleanField(
      manifestToml,
      'include_trend_summary',
    );

    expect(new Set(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.event.allowed_reasons)).toEqual(
      new Set(manifestAllowedReasons),
    );
    expect(
      new Set(
        FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.event.reason_catalog.map(
          descriptor => descriptor.reason_id,
        ),
      ),
    ).toEqual(new Set(manifestCatalogReasonIds));
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.trend.reason_history_limit)
      .toBe(manifestReasonHistoryLimit);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.trend.decay_window_ms)
      .toBe(manifestDecayWindowMs);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.trend.cooldown_window_ms)
      .toBe(manifestCooldownWindowMs);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.trend.top_reason_count).toBe(manifestTopReasonCount);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.event.trend_summary_top_count)
      .toBe(manifestEventTrendSummaryTopCount);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.event.include_trend_summary)
      .toBe(manifestIncludeTrendSummary);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.event.trend_summary_min_severity)
      .toBe(manifestEventTrendSummaryMinSeverity);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.trend.default_warn_count).toBe(manifestDefaultWarnCount);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.trend.default_error_count).toBe(manifestDefaultErrorCount);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.trend.decay_window_ms).toBe(manifestDecayWindowMs);
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.trend.cooldown_window_ms).toBe(manifestCooldownWindowMs);
    expect(
      new Set(
        FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.trend.reason_thresholds.map(
          threshold =>
            `${threshold.reason_id}:${threshold.warn_count}:${threshold.error_count}:${threshold.warn_action_hint ?? ''}:${threshold.error_action_hint ?? ''}`,
        ),
      ),
    ).toEqual(
      new Set(
        manifestTrendReasonThresholds.map(
          threshold =>
            `${threshold.reason_id}:${threshold.warn_count}:${threshold.error_count}:${threshold.warn_action_hint ?? ''}:${threshold.error_action_hint ?? ''}`,
        ),
      ),
    );
    expect(FALLBACK_TIMELINE_DIAGNOSTICS_POLICY.field_visibility.show_recent_reason_counts)
      .toBe(manifestShowRecentReasonCounts);
  });
});
