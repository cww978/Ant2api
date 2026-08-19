/**
 * Patch Preflight & V4A Auto-Repair Engine for Codex
 * Ported and enhanced from Rust proxy `apply_patch_preflight.rs`.
 *
 * Solves the primary cause of Codex apply_patch failures:
 * - "apply_patch verification failed: Failed to find expected lines"
 * - Double-sided @@ headers (@@ <header> @@)
 * - Unified diff formatted headers (--- a/file / +++ b/file)
 * - Unprefixed lines in Add File
 * - Missing envelope boundaries (*** Begin Patch / *** End Patch)
 */

export interface PatchRepair {
  file: string;
  kind: string;
  detail: string;
}

export class PatchPreflightService {
  /**
   * Extracts raw patch string from tool arguments which could be:
   * 1. A JSON string containing `{ "patch": "..." }` or `{ "input": "..." }`
   * 2. An object with `patch` or `input` property
   * 3. A raw string starting with `*** Begin Patch` or unified diff format
   */
  public static extractPatchInput(args: any): string {
    if (!args) return '';
    if (typeof args === 'string') {
      const trimmed = args.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            if (typeof parsed.patch === 'string') return parsed.patch;
            if (typeof parsed.input === 'string') return parsed.input;
            if (typeof parsed.content === 'string') return parsed.content;
            if (typeof parsed.diff === 'string') return parsed.diff;
          }
        } catch {}
      }
      return args;
    }
    if (typeof args === 'object') {
      if (typeof args.patch === 'string') return args.patch;
      if (typeof args.input === 'string') return args.input;
      if (typeof args.content === 'string') return args.content;
      if (typeof args.diff === 'string') return args.diff;
      try {
        return JSON.stringify(args);
      } catch {
        return '';
      }
    }
    return String(args);
  }

  /**
   * Strips trailing `@@` from double-sided `@@ <header> @@` lines.
   * Codex V4A expects single-sided `@@ <header>`, otherwise it treats the trailing `@@`
   * as literal text to find in the file.
   */
  public static stripTrailingAt(v4a: string): { patch: string; repairs: PatchRepair[] } {
    let changed = 0;
    const lines = v4a.split(/\r?\n/);
    const out: string[] = [];

    for (const l of lines) {
      if (l.startsWith('@@')) {
        const trimmed = l.trimEnd();
        // Naked '@@' (length 2) is a valid section separator. Only '@@ header @@' needs stripping.
        if (trimmed.length > 2 && trimmed.endsWith('@@')) {
          const body = trimmed.slice(0, -2).trimEnd();
          if (body.length > 0 && body !== '@@') {
            changed++;
            out.push(body);
            continue;
          }
        }
      }
      out.push(l);
    }

    const repairs: PatchRepair[] = [];
    if (changed > 0) {
      repairs.push({
        file: '(@@ header)',
        kind: 'repaired',
        detail: `Converted double-sided @@ to single-sided @@ on ${changed} lines`
      });
    }

    return { patch: out.join('\n') + (v4a.endsWith('\n') ? '\n' : ''), repairs };
  }

  /**
   * Converts standard Unified Diff file headers (--- a/file \n +++ b/file) into V4A
   * *** Update File: file or *** Add File: file headers.
   */
  public static convertUnifiedFileHeaders(v4a: string): { patch: string; repairs: PatchRepair[] } {
    const lines = v4a.split(/\r?\n/);
    const out: string[] = [];
    const repairs: PatchRepair[] = [];
    let i = 0;
    let converted = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('--- ') && i + 1 < lines.length && lines[i + 1].startsWith('+++ ')) {
        const minusPath = line.slice(4).trim();
        const plusPath = lines[i + 1].slice(4).trim();

        const cleanMinus = this.normalizeDiffPath(minusPath);
        const cleanPlus = this.normalizeDiffPath(plusPath);

        if (cleanMinus === null && cleanPlus !== null) {
          // Add File
          out.push(`*** Add File: ${cleanPlus}`);
          repairs.push({
            file: cleanPlus,
            kind: 'repaired:unified_header_to_v4a',
            detail: `Converted --- /dev/null +++ ${cleanPlus} to *** Add File: ${cleanPlus}`
          });
          converted++;
          i += 2;
          continue;
        } else if (cleanMinus !== null && cleanPlus === null) {
          // Delete File
          out.push(`*** Delete File: ${cleanMinus}`);
          repairs.push({
            file: cleanMinus,
            kind: 'repaired:unified_header_to_v4a',
            detail: `Converted --- ${cleanMinus} +++ /dev/null to *** Delete File: ${cleanMinus}`
          });
          converted++;
          i += 2;
          continue;
        } else if (cleanPlus !== null) {
          // Update File
          out.push(`*** Update File: ${cleanPlus}`);
          repairs.push({
            file: cleanPlus,
            kind: 'repaired:unified_header_to_v4a',
            detail: `Converted --- ${minusPath} +++ ${plusPath} to *** Update File: ${cleanPlus}`
          });
          converted++;
          i += 2;
          continue;
        }
      }
      out.push(line);
      i++;
    }

    return { patch: out.join('\n') + (v4a.endsWith('\n') ? '\n' : ''), repairs };
  }

  private static normalizeDiffPath(path: string): string | null {
    let p = path.trim();
    if (p === '/dev/null' || p === '') return null;
    if ((p.startsWith('a/') || p.startsWith('b/')) && p.length > 2) {
      p = p.slice(2);
    }
    return p;
  }

  /**
   * Normalizes unified diff hunk ranges `@@ -1,5 +1,6 @@` into clean `@@` or `@@ <header>`
   */
  public static stripUnifiedHunkRanges(v4a: string): { patch: string; repairs: PatchRepair[] } {
    let changed = 0;
    const lines = v4a.split(/\r?\n/);
    const out: string[] = [];

    for (const l of lines) {
      if (l.startsWith('@@ -') || l.startsWith('@@ +')) {
        // e.g. @@ -10,7 +10,8 @@ function foo()
        const match = l.match(/^@@\s+-[0-9,]+\s+\+[0-9,]+\s+@@(.*)$/);
        if (match) {
          const suffix = match[1]?.trim() || '';
          changed++;
          out.push(suffix ? `@@ ${suffix}` : '@@');
          continue;
        }
      }
      out.push(l);
    }

    const repairs: PatchRepair[] = [];
    if (changed > 0) {
      repairs.push({
        file: '(unified hunk range)',
        kind: 'repaired',
        detail: `Stripped unified range numbers @@ -a,b +c,d @@ on ${changed} lines`
      });
    }

    return { patch: out.join('\n') + (v4a.endsWith('\n') ? '\n' : ''), repairs };
  }

  /**
   * Ensures that lines within `*** Add File: path` blocks start with `+`
   */
  public static ensureAddFilePlus(v4a: string): { patch: string; repairs: PatchRepair[] } {
    const lines = v4a.split(/\r?\n/);
    const out: string[] = [];
    const repairs: PatchRepair[] = [];
    let inAddFile = false;
    let currentAddFilePath = '';
    let patchedCount = 0;

    for (const l of lines) {
      if (l.startsWith('*** Add File: ')) {
        inAddFile = true;
        currentAddFilePath = l.slice(14).trim();
        out.push(l);
        continue;
      }
      if (l.startsWith('*** Update File: ') || l.startsWith('*** Delete File: ') || l.startsWith('*** End Patch')) {
        inAddFile = false;
        out.push(l);
        continue;
      }

      if (inAddFile) {
        if (l.startsWith('*** Begin Patch') || l.startsWith('*** End Patch')) {
          out.push(l);
          continue;
        }
        if (l.length > 0 && !l.startsWith('+')) {
          // If the model missed the + prefix in Add File block, add it
          out.push(`+${l}`);
          patchedCount++;
          continue;
        }
      }
      out.push(l);
    }

    if (patchedCount > 0) {
      repairs.push({
        file: currentAddFilePath || '(Add File)',
        kind: 'repaired',
        detail: `Prefixed ${patchedCount} missing '+' lines in Add File block`
      });
    }

    return { patch: out.join('\n') + (v4a.endsWith('\n') ? '\n' : ''), repairs };
  }

  /**
   * Ensures that the patch has proper `*** Begin Patch` and `*** End Patch` boundaries.
   */
  public static ensureV4aEnvelope(v4a: string): { patch: string; repair?: PatchRepair } {
    let s = v4a.trim();
    if (!s) return { patch: v4a };

    let addedBegin = false;
    let addedEnd = false;

    if (!s.startsWith('*** Begin Patch')) {
      // Find where the first file operation starts
      const firstOp = s.search(/\*\*\* (Update|Add|Delete) File:/);
      if (firstOp !== -1) {
        s = '*** Begin Patch\n' + s.slice(firstOp);
        addedBegin = true;
      } else {
        s = '*** Begin Patch\n' + s;
        addedBegin = true;
      }
    }

    if (!s.includes('*** End Patch')) {
      s = s + '\n*** End Patch';
      addedEnd = true;
    }

    let repair: PatchRepair | undefined = undefined;
    if (addedBegin || addedEnd) {
      repair = {
        file: '(envelope)',
        kind: 'repaired',
        detail: `Added missing envelope boundaries (begin=${addedBegin}, end=${addedEnd})`
      };
    }

    return { patch: s, repair };
  }

  /**
   * Full multi-tier optimization pipeline on a V4A patch.
   */
  public static optimizePatch(
    v4a: string,
    options: { jsonComplete?: boolean } = { jsonComplete: true }
  ): { patch: string; repairs: PatchRepair[] } {
    const rawPatch = this.extractPatchInput(v4a);
    if (!rawPatch.trim()) {
      return { patch: rawPatch, repairs: [] };
    }

    let s = rawPatch;
    const allRepairs: PatchRepair[] = [];

    // Tier 1: Double-sided @@ stripping
    const r1 = this.stripTrailingAt(s);
    s = r1.patch;
    allRepairs.push(...r1.repairs);

    // Tier 2: Convert unified diff headers (--- / +++) to V4A
    const r2 = this.convertUnifiedFileHeaders(s);
    s = r2.patch;
    allRepairs.push(...r2.repairs);

    // Tier 3: Strip unified hunk ranges
    const r3 = this.stripUnifiedHunkRanges(s);
    s = r3.patch;
    allRepairs.push(...r3.repairs);

    // Tier 4: Ensure Add File has '+' prefixes
    const r4 = this.ensureAddFilePlus(s);
    s = r4.patch;
    allRepairs.push(...r4.repairs);

    // Tier 5: Envelope boundaries wrapping
    if (options.jsonComplete !== false) {
      const r5 = this.ensureV4aEnvelope(s);
      s = r5.patch;
      if (r5.repair) allRepairs.push(r5.repair);
    }

    return { patch: s, repairs: allRepairs };
  }

  /**
   * Fast validation of a V4A patch. Returns invalid line info if malformed.
   */
  public static validateV4a(v4a: string): { valid: boolean; line?: number; message?: string } {
    const lines = v4a.split(/\r?\n/);
    let inEnvelope = false;
    let hasOp = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === '*** Begin Patch') {
        inEnvelope = true;
        continue;
      }
      if (line === '*** End Patch') {
        inEnvelope = false;
        continue;
      }
      if (line.startsWith('*** Update File:') || line.startsWith('*** Add File:') || line.startsWith('*** Delete File:')) {
        hasOp = true;
        continue;
      }
    }

    if (!hasOp) {
      return { valid: false, message: 'Patch does not contain any file operations (*** Update/Add/Delete File:)' };
    }

    return { valid: true };
  }
}
