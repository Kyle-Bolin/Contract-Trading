import type { ManualOverrideEntry } from './types';
import { normalizeName } from './edgar-loader';

const OVERRIDES: ManualOverrideEntry[] = [
  // Top government contractors
  { companyName: 'LOCKHEED MARTIN', ticker: 'LMT', exchange: 'NYSE' },
  { companyName: 'LOCKHEED MARTIN CORPORATION', ticker: 'LMT', exchange: 'NYSE' },
  { companyName: 'LOCKHEED MARTIN CORP', ticker: 'LMT', exchange: 'NYSE' },
  { companyName: 'BOEING', ticker: 'BA', exchange: 'NYSE' },
  { companyName: 'THE BOEING COMPANY', ticker: 'BA', exchange: 'NYSE' },
  { companyName: 'BOEING COMPANY', ticker: 'BA', exchange: 'NYSE' },
  { companyName: 'RTX CORP', ticker: 'RTX', exchange: 'NYSE' },
  { companyName: 'RTX CORPORATION', ticker: 'RTX', exchange: 'NYSE' },
  { companyName: 'RAYTHEON', ticker: 'RTX', exchange: 'NYSE' },
  { companyName: 'RAYTHEON TECHNOLOGIES', ticker: 'RTX', exchange: 'NYSE' },
  { companyName: 'RAYTHEON COMPANY', ticker: 'RTX', exchange: 'NYSE' },
  { companyName: 'GENERAL DYNAMICS', ticker: 'GD', exchange: 'NYSE' },
  { companyName: 'GENERAL DYNAMICS CORPORATION', ticker: 'GD', exchange: 'NYSE' },
  { companyName: 'GENERAL DYNAMICS CORP', ticker: 'GD', exchange: 'NYSE' },
  { companyName: 'NORTHROP GRUMMAN', ticker: 'NOC', exchange: 'NYSE' },
  { companyName: 'NORTHROP GRUMMAN CORPORATION', ticker: 'NOC', exchange: 'NYSE' },
  { companyName: 'NORTHROP GRUMMAN CORP', ticker: 'NOC', exchange: 'NYSE' },
  { companyName: 'L3HARRIS', ticker: 'LHX', exchange: 'NYSE' },
  { companyName: 'L3HARRIS TECHNOLOGIES', ticker: 'LHX', exchange: 'NYSE' },
  { companyName: 'L3 HARRIS TECHNOLOGIES', ticker: 'LHX', exchange: 'NYSE' },
  { companyName: 'LEIDOS', ticker: 'LDOS', exchange: 'NYSE' },
  { companyName: 'LEIDOS HOLDINGS', ticker: 'LDOS', exchange: 'NYSE' },
  { companyName: 'BOOZ ALLEN HAMILTON', ticker: 'BAH', exchange: 'NYSE' },
  { companyName: 'BOOZ ALLEN HAMILTON HOLDING', ticker: 'BAH', exchange: 'NYSE' },
  { companyName: 'BOOZ ALLEN HAMILTON HOLDING CORPORATION', ticker: 'BAH', exchange: 'NYSE' },
  { companyName: 'SAIC', ticker: 'SAIC', exchange: 'NYSE' },
  { companyName: 'SCIENCE APPLICATIONS INTERNATIONAL', ticker: 'SAIC', exchange: 'NYSE' },
  { companyName: 'SCIENCE APPLICATIONS INTERNATIONAL CORPORATION', ticker: 'SAIC', exchange: 'NYSE' },
  { companyName: 'HUNTINGTON INGALLS', ticker: 'HII', exchange: 'NYSE' },
  { companyName: 'HUNTINGTON INGALLS INDUSTRIES', ticker: 'HII', exchange: 'NYSE' },
  { companyName: 'GENERAL ELECTRIC', ticker: 'GE', exchange: 'NYSE' },
  { companyName: 'GENERAL ELECTRIC COMPANY', ticker: 'GE', exchange: 'NYSE' },
  { companyName: 'GE AEROSPACE', ticker: 'GE', exchange: 'NYSE' },
  { companyName: 'BAE SYSTEMS', ticker: 'BAESY', exchange: 'OTC' },
  { companyName: 'TEXTRON', ticker: 'TXT', exchange: 'NYSE' },
  { companyName: 'TEXTRON INC', ticker: 'TXT', exchange: 'NYSE' },
  { companyName: 'HONEYWELL', ticker: 'HON', exchange: 'NASDAQ' },
  { companyName: 'HONEYWELL INTERNATIONAL', ticker: 'HON', exchange: 'NASDAQ' },
  { companyName: 'CACI INTERNATIONAL', ticker: 'CACI', exchange: 'NYSE' },
  { companyName: 'CACI', ticker: 'CACI', exchange: 'NYSE' },
  { companyName: 'PERSPECTA', ticker: 'PRSP', exchange: 'NYSE' },
  { companyName: 'MANTECH INTERNATIONAL', ticker: 'MANT', exchange: 'NASDAQ' },
  { companyName: 'MANTECH', ticker: 'MANT', exchange: 'NASDAQ' },
  { companyName: 'PARSONS', ticker: 'PSN', exchange: 'NYSE' },
  { companyName: 'PARSONS CORPORATION', ticker: 'PSN', exchange: 'NYSE' },
  { companyName: 'KBR', ticker: 'KBR', exchange: 'NYSE' },
  { companyName: 'KBR INC', ticker: 'KBR', exchange: 'NYSE' },
  { companyName: 'AMENTUM', ticker: 'AMTM', exchange: 'NYSE' },
  { companyName: 'BWX TECHNOLOGIES', ticker: 'BWXT', exchange: 'NYSE' },
  { companyName: 'BWXT', ticker: 'BWXT', exchange: 'NYSE' },
  { companyName: 'CURTISS WRIGHT', ticker: 'CW', exchange: 'NYSE' },
  { companyName: 'CURTISS-WRIGHT', ticker: 'CW', exchange: 'NYSE' },
  { companyName: 'ELBIT SYSTEMS', ticker: 'ESLT', exchange: 'NASDAQ' },
  { companyName: 'KRATOS DEFENSE', ticker: 'KTOS', exchange: 'NASDAQ' },
  { companyName: 'KRATOS DEFENSE AND SECURITY SOLUTIONS', ticker: 'KTOS', exchange: 'NASDAQ' },
  { companyName: 'MERCURY SYSTEMS', ticker: 'MRCY', exchange: 'NASDAQ' },
  { companyName: 'PALANTIR', ticker: 'PLTR', exchange: 'NYSE' },
  { companyName: 'PALANTIR TECHNOLOGIES', ticker: 'PLTR', exchange: 'NYSE' },
  { companyName: 'MICROSOFT', ticker: 'MSFT', exchange: 'NASDAQ' },
  { companyName: 'MICROSOFT CORPORATION', ticker: 'MSFT', exchange: 'NASDAQ' },
  { companyName: 'AMAZON', ticker: 'AMZN', exchange: 'NASDAQ' },
  { companyName: 'AMAZON WEB SERVICES', ticker: 'AMZN', exchange: 'NASDAQ' },
  { companyName: 'AMAZON.COM', ticker: 'AMZN', exchange: 'NASDAQ' },
  { companyName: 'GOOGLE', ticker: 'GOOGL', exchange: 'NASDAQ' },
  { companyName: 'ALPHABET', ticker: 'GOOGL', exchange: 'NASDAQ' },
  { companyName: 'IBM', ticker: 'IBM', exchange: 'NYSE' },
  { companyName: 'INTERNATIONAL BUSINESS MACHINES', ticker: 'IBM', exchange: 'NYSE' },
  { companyName: 'ORACLE', ticker: 'ORCL', exchange: 'NYSE' },
  { companyName: 'ORACLE CORPORATION', ticker: 'ORCL', exchange: 'NYSE' },
];

let overrideMap: Map<string, ManualOverrideEntry> | null = null;

function buildOverrideMap(): Map<string, ManualOverrideEntry> {
  if (overrideMap) return overrideMap;
  overrideMap = new Map();
  for (const entry of OVERRIDES) {
    overrideMap.set(normalizeName(entry.companyName), entry);
  }
  return overrideMap;
}

export function getManualOverride(companyName: string): ManualOverrideEntry | undefined {
  const map = buildOverrideMap();
  return map.get(normalizeName(companyName));
}

export function getAllOverrides(): Map<string, ManualOverrideEntry> {
  return buildOverrideMap();
}
