import { Evidence } from '../services/evidenceService';
import { Indicator } from '../services/evaluationService';

export interface ProgressResult {
  approved: number;
  pending: number;
  total: number; // approved + pending
}

/**
 * Calculates the completion percentage for a single indicator based on approved and pending evidence.
 */
export const calculateIndicatorProgress = (evidence: Evidence[], targetCount: number = 6): ProgressResult => {
  if (targetCount <= 0) return { approved: 0, pending: 0, total: 0 };
  
  const approvedCount = evidence.filter(e => e.status === 'approved').length;
  const pendingCount = evidence.filter(e => e.status === 'pending').length;
  
  return {
    approved: Math.min((approvedCount / targetCount) * 100, 100),
    pending: Math.min((pendingCount / targetCount) * 100, 100),
    total: Math.min(((approvedCount + pendingCount) / targetCount) * 100, 100)
  };
};

/**
 * Calculates the average progress for a set of items (indicators, standards, or domains).
 * Filters out items with no data to avoid misleading 0% vs "no data".
 */
export const calculateAverageProgress = (percentages: number[]): number => {
  if (percentages.length === 0) return 0;
  const sum = percentages.reduce((acc, curr) => acc + curr, 0);
  return sum / percentages.length;
};
