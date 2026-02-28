import type { CompanyProfile } from '@/lib/clients/finnhub/types';
import type { AwardInput, SignalConfig, SignalFactors, TradingSignal } from './types';

const DISCLAIMER =
  'This is an informational signal only and does not constitute financial advice. ' +
  'Past contract awards do not guarantee future stock performance. ' +
  'Always conduct your own research before making investment decisions.';

function getDefaultConfig(): SignalConfig {
  return {
    strongRatioThreshold: parseFloat(process.env.SIGNAL_STRONG_RATIO_THRESHOLD ?? '0.05'),
    moderateRatioThreshold: parseFloat(process.env.SIGNAL_MODERATE_RATIO_THRESHOLD ?? '0.01'),
    momentumWindow: parseInt(process.env.SIGNAL_MOMENTUM_WINDOW ?? '30', 10),
  };
}

function calculatePipelineMomentum(
  recentAwards: AwardInput[],
  momentumWindow: number,
): { momentum: SignalFactors['pipelineMomentum']; count30d: number; total30d: number } {
  const now = new Date();
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - momentumWindow * 24 * 60 * 60 * 1000);
  const priorWindowStart = new Date(windowStart.getTime() - momentumWindow * 24 * 60 * 60 * 1000);

  let recentTotal = 0;
  let recentCount = 0;
  let priorTotal = 0;

  for (const award of recentAwards) {
    const awardDate = new Date(award.awardDate);
    if (awardDate >= windowStart && awardDate <= windowEnd) {
      recentTotal += award.awardAmount;
      recentCount++;
    } else if (awardDate >= priorWindowStart && awardDate < windowStart) {
      priorTotal += award.awardAmount;
    }
  }

  let momentum: SignalFactors['pipelineMomentum'];
  if (priorTotal === 0 && recentTotal > 0) {
    momentum = 'increasing';
  } else if (priorTotal === 0 && recentTotal === 0) {
    momentum = 'stable';
  } else if (recentTotal > priorTotal * 1.2) {
    momentum = 'increasing';
  } else if (recentTotal < priorTotal * 0.8) {
    momentum = 'decreasing';
  } else {
    momentum = 'stable';
  }

  return { momentum, count30d: recentCount, total30d: recentTotal };
}

export function generateSignal(
  award: AwardInput,
  companyProfile: CompanyProfile | null,
  recentAwards: AwardInput[],
  config?: Partial<SignalConfig>,
): TradingSignal {
  const resolvedConfig = { ...getDefaultConfig(), ...config };
  const ticker = companyProfile?.ticker ?? '';
  const marketCap = companyProfile?.marketCapitalization ?? 0;

  // If company is not publicly traded (no profile or zero market cap), return neutral/weak
  if (!companyProfile || marketCap <= 0) {
    const { momentum, count30d, total30d } = calculatePipelineMomentum(
      recentAwards,
      resolvedConfig.momentumWindow,
    );

    return {
      ticker: ticker || 'N/A',
      signal: 'neutral',
      confidence: 'weak',
      factors: {
        awardToMarketCapRatio: 0,
        awardAmount: award.awardAmount,
        marketCap: 0,
        recentAwardCount30d: count30d,
        recentAwardTotal30d: total30d,
        pipelineMomentum: momentum,
      },
      disclaimer: DISCLAIMER,
    };
  }

  // Finnhub returns marketCapitalization in millions USD
  const marketCapFullValue = marketCap * 1_000_000;
  const ratio = award.awardAmount / marketCapFullValue;

  const { momentum, count30d, total30d } = calculatePipelineMomentum(
    recentAwards,
    resolvedConfig.momentumWindow,
  );

  // Determine base signal from ratio thresholds
  let signal: TradingSignal['signal'];
  let confidence: TradingSignal['confidence'];

  if (ratio >= resolvedConfig.strongRatioThreshold) {
    signal = 'buy';
    confidence = 'strong';
  } else if (ratio >= resolvedConfig.moderateRatioThreshold) {
    signal = 'buy';
    confidence = 'moderate';
  } else {
    signal = 'neutral';
    confidence = 'weak';
  }

  // Adjust confidence based on momentum
  if (signal === 'buy' && momentum === 'increasing' && confidence === 'moderate') {
    // Strong pipeline momentum reinforces a moderate buy
    confidence = 'strong';
  } else if (signal === 'buy' && momentum === 'decreasing' && confidence === 'strong') {
    // Decreasing momentum downgrades a strong signal
    confidence = 'moderate';
  }

  return {
    ticker,
    signal,
    confidence,
    factors: {
      awardToMarketCapRatio: ratio,
      awardAmount: award.awardAmount,
      marketCap: marketCapFullValue,
      recentAwardCount30d: count30d,
      recentAwardTotal30d: total30d,
      pipelineMomentum: momentum,
    },
    disclaimer: DISCLAIMER,
  };
}
