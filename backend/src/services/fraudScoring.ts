import {
  FraudRiskCategory,
  FraudRiskInputs,
  FraudRiskResult,
  FraudRuleEvaluation,
} from '../types/index.js';

export const FRAUD_DISCLAIMER =
  'This is a demonstrative, rule-based fraud-risk scoring model for hackathon testing and integration. It is not a production-grade fraud detection model and does not interface with live external transaction surveillance networks.';

export interface FraudRuleConfig {
  highAmountThreshold: number;
  anomalyMultiplierThreshold: number;
  velocityHourlyThreshold: number;
  unusualHoursUtc: number[]; // e.g. [1, 2, 3, 4]
}

export const DEFAULT_FRAUD_CONFIG: FraudRuleConfig = {
  highAmountThreshold: 10000,
  anomalyMultiplierThreshold: 4,
  velocityHourlyThreshold: 5,
  unusualHoursUtc: [1, 2, 3, 4],
};

/**
 * Evaluates fraud risk using explainable, deterministic rules.
 */
export function evaluateFraudRisk(
  inputs: FraudRiskInputs,
  config: FraudRuleConfig = DEFAULT_FRAUD_CONFIG
): FraudRiskResult {
  const evaluations: FraudRuleEvaluation[] = [];
  const reasons: string[] = [];

  // Rule 1: High Absolute Transaction Amount
  const isHighAmount = inputs.transactionAmount >= config.highAmountThreshold;
  evaluations.push({
    ruleId: 'RULE_HIGH_AMOUNT',
    description: `Transaction amount >= $${config.highAmountThreshold.toLocaleString()}`,
    triggered: isHighAmount,
    points: 25,
    details: isHighAmount
      ? `Transaction amount of $${inputs.transactionAmount} exceeds threshold $${config.highAmountThreshold}`
      : undefined,
  });
  if (isHighAmount) {
    reasons.push(
      `High transaction amount ($${inputs.transactionAmount.toLocaleString()} exceeds threshold of $${config.highAmountThreshold.toLocaleString()})`
    );
  }

  // Rule 2: Amount Anomaly Relative to User Average
  let isAnomaly = false;
  if (inputs.userAverageAmount && inputs.userAverageAmount > 0) {
    const ratio = inputs.transactionAmount / inputs.userAverageAmount;
    isAnomaly = ratio >= config.anomalyMultiplierThreshold;
    evaluations.push({
      ruleId: 'RULE_AMOUNT_ANOMALY',
      description: `Transaction amount exceeds ${config.anomalyMultiplierThreshold}x user historical average`,
      triggered: isAnomaly,
      points: 25,
      details: isAnomaly
        ? `Ratio is ${ratio.toFixed(2)}x (average was $${inputs.userAverageAmount})`
        : undefined,
    });
    if (isAnomaly) {
      reasons.push(
        `Transaction amount is ${ratio.toFixed(1)}x greater than user historical average of $${inputs.userAverageAmount}`
      );
    }
  }

  // Rule 3: Velocity Check (Multiple Transactions in Short Window)
  const isVelocityTriggered =
    (inputs.userTransactionsLastHour ?? 0) >= config.velocityHourlyThreshold;
  evaluations.push({
    ruleId: 'RULE_HIGH_VELOCITY',
    description: `Transaction velocity >= ${config.velocityHourlyThreshold} transactions in the last hour`,
    triggered: isVelocityTriggered,
    points: 25,
    details: isVelocityTriggered
      ? `User conducted ${inputs.userTransactionsLastHour} transactions in past 60 minutes`
      : undefined,
  });
  if (isVelocityTriggered) {
    reasons.push(
      `High transaction velocity (${inputs.userTransactionsLastHour} transactions in the last hour)`
    );
  }

  // Rule 4: Geolocation / Origin IP Mismatch
  const isLocationMismatch = Boolean(inputs.locationMismatch);
  evaluations.push({
    ruleId: 'RULE_LOCATION_MISMATCH',
    description: 'Transaction originating from unfamiliar or unexpected geographical location',
    triggered: isLocationMismatch,
    points: 20,
    details: isLocationMismatch ? 'Unusual geolocation or IP mismatch detected' : undefined,
  });
  if (isLocationMismatch) {
    reasons.push('Location mismatch detected relative to customary user profile');
  }

  // Rule 5: New or Unrecognized Device
  const isNewDevice = Boolean(inputs.isNewDevice);
  evaluations.push({
    ruleId: 'RULE_NEW_DEVICE',
    description: 'Transaction initiated from a previously unregistered device',
    triggered: isNewDevice,
    points: 15,
    details: isNewDevice ? 'Unrecognized device signature' : undefined,
  });
  if (isNewDevice) {
    reasons.push('Transaction initiated from an unrecognized device');
  }

  // Rule 6: Unusual Transaction Hours
  const isUnusualHour =
    inputs.transactionHourUtc !== undefined &&
    config.unusualHoursUtc.includes(inputs.transactionHourUtc);
  evaluations.push({
    ruleId: 'RULE_UNUSUAL_HOUR',
    description: `Transaction initiated during high-risk hours (${config.unusualHoursUtc.join(', ')} UTC)`,
    triggered: isUnusualHour,
    points: 10,
    details: isUnusualHour ? `Initiated at ${inputs.transactionHourUtc}:00 UTC` : undefined,
  });
  if (isUnusualHour) {
    reasons.push(`Transaction occurred during unusual late-night hours (${inputs.transactionHourUtc}:00 UTC)`);
  }

  // Rule 7: Rapid Cross-Border Transfers
  const isRapidCrossBorder = Boolean(inputs.rapidCrossBorderTransfers);
  evaluations.push({
    ruleId: 'RULE_RAPID_CROSS_BORDER',
    description: 'Rapid successive international / cross-border transfer activity',
    triggered: isRapidCrossBorder,
    points: 30,
    details: isRapidCrossBorder ? 'Rapid successive cross-border transfers flagged' : undefined,
  });
  if (isRapidCrossBorder) {
    reasons.push('Rapid successive cross-border transfers flagged');
  }

  // Calculate composite score (capped at 100)
  const totalPoints = evaluations
    .filter((e) => e.triggered)
    .reduce((sum, e) => sum + e.points, 0);

  const riskScore = Math.min(100, Math.max(0, totalPoints));

  // Determine Category
  let riskCategory: FraudRiskCategory;
  if (riskScore <= 20) {
    riskCategory = 'LOW';
  } else if (riskScore <= 50) {
    riskCategory = 'MEDIUM';
  } else if (riskScore <= 75) {
    riskCategory = 'HIGH';
  } else {
    riskCategory = 'CRITICAL';
  }

  if (reasons.length === 0) {
    reasons.push('No suspicious risk indicators detected; transaction profile aligns with standard baseline');
  }

  return {
    riskScore,
    riskCategory,
    reasons,
    ruleEvaluations: evaluations,
    evaluatedAt: new Date().toISOString(),
    disclaimer: FRAUD_DISCLAIMER,
  };
}
