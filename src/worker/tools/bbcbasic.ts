import { BuildStep, BuildStepResult } from '../builder';
import { gatherFiles, getWorkFileAsString, putWorkFile, staleFiles } from '../builder';

/**
 * BBC BASIC compiler (scaffold)
 *
 * For now, this is a stub that passes through ASCII BASIC source as a binary file.
 * Next milestone: integrate a proper BBC BASIC tokenizer to emit tokenized program bytes.
 */
export function compileBbcBasic(step: BuildStep): BuildStepResult {
  const outputPath = step.prefix + '.bin';

  // Bring all project files into the worker FS (for consistency)
  gatherFiles(step);

  if (staleFiles(step, [outputPath])) {
    try {
      const source = getWorkFileAsString(step.path) || '';

      // Scaffold: write ASCII source as bytes for now
      const asciiBytes = new TextEncoder().encode(source);
      putWorkFile(outputPath, asciiBytes);

      return {
        output: asciiBytes,
        listings: {},
        errors: []
      };
    } catch (error) {
      return {
        errors: [{
          msg: error instanceof Error ? error.message : String(error),
          line: 0,
          path: step.path
        }]
      };
    }
  }

  return { unchanged: true };
}


