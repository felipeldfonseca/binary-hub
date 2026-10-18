/**
 * @jest-environment node
 *
 * The lint rule that keeps lib/domain plain (.eslintrc.json, the lib/domain override): an import of
 * lib/hub, Supabase, React or the legacy readers in a lib/domain file is an error. The files below
 * are never written: ESLint lints the text as if it lived at that path.
 */
import path from 'node:path';

// The project has no @types/eslint: only the part of ESLint 8's API this test uses
type LintMessage = { ruleId: string | null; message: string };
type Linter = { lintText(code: string, options: { filePath: string }): Promise<{ messages: LintMessage[] }[]> };
const { ESLint } = require('eslint') as { ESLint: new (options: { cwd: string }) => Linter };

const APP = path.resolve(__dirname, '../..');
const eslint = new ESLint({ cwd: APP });

async function restricted(file: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${source}\nexport const n = 1;\n`, { filePath: path.join(APP, file) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message);
}

describe('lib/domain imports only itself and the standard library', () => {
  jest.setTimeout(60_000);

  it.each([
    ['lib/domain/markets.ts', "import { windowError } from '@/lib/hub/regras';"],
    ['lib/domain/markets.ts', "import * as hub from '@/lib/hub';"],
    ['lib/domain/markets.ts', "import { windowError } from '../hub/regras';"],
    ['lib/domain/gate/rules.ts', "import { POSSO } from '../../hub/posso';"],
    ['lib/domain/gate/rules.ts', "export { windowError } from '@/lib/hub/regras';"],
  ])('%s: %s is refused as a lib/hub import', async (file, source) => {
    expect(await restricted(file, source)).toEqual([
      expect.stringContaining('lib/domain never imports lib/hub'),
    ]);
  });

  it.each([
    ['lib/domain/markets.ts', "import { createClient } from '@supabase/supabase-js';"],
    ['lib/domain/gate/rules.ts', "import { useState } from 'react';"],
    ['lib/domain/import/types.ts', "import { parse } from '@/lib/utils/topOneParser';"],
  ])('%s: %s is still refused', async (file, source) => {
    expect(await restricted(file, source)).not.toEqual([]);
  });

  it('allows lib/domain to import itself, and lib/hub to import lib/hub and lib/domain', async () => {
    expect(await restricted('lib/domain/gate/rules.ts', "import { MARKET_SPEC } from '../markets';")).toEqual([]);
    expect(await restricted('lib/domain/markets.ts', "import { tradingDayOn } from '@/lib/domain/tempo';")).toEqual([]);
    expect(await restricted('lib/hub/regras.ts', "import { janelas } from '@/lib/hub/janelas';\nimport { MARKET_SPEC } from '@/lib/domain';")).toEqual([]);
  });
});
