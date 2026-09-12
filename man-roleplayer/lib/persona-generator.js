// src/persona/registry.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

// src/persona/manifest-schema.ts
import { z } from "zod";
var personaIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "PersonaId must be kebab-case");
var personaStatusSchema = z.enum(["active", "retired"]);
var personaContentManifestSchema = z.object({
  prompt: z.string().min(1),
  anecdotes: z.string().min(1),
  quotes: z.string().min(1),
  blacklist: z.string().min(1)
}).strict();
var personaManifestSchema = z.object({
  id: personaIdSchema,
  displayName: z.string().min(1),
  status: personaStatusSchema,
  legacyIds: z.array(z.string().min(1)).default([]),
  content: personaContentManifestSchema
}).strict();

// src/persona/registry.ts
function safeContentPath(packageDir, value, field) {
  if (isAbsolute(value)) throw new Error(`persona content ${field} must be relative: ${value}`);
  const root = resolve(packageDir);
  const target = resolve(root, value);
  const rel = relative(root, target);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`persona content ${field} escapes package: ${value}`);
  }
  return target;
}
function loadJson(path, field) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`cannot load persona ${field} content ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(value)) throw new Error(`persona ${field} content must be an array: ${path}`);
  return value;
}
function assertEntryOwnership(entries, id, field) {
  for (const entry of entries) {
    if (field === "blacklist") {
      if (!entry || typeof entry !== "object" || !("personaId" in entry) || entry.personaId !== id) {
        throw new Error(`persona ${id} ${field} entry ownership mismatch`);
      }
    } else if (field === "anecdotes" || field === "quotes") {
      if (!entry || typeof entry !== "object" || !("personaId" in entry) || entry.personaId !== id) {
        throw new Error(`persona ${id} ${field} entry ownership mismatch`);
      }
    }
  }
}
var PersonaRegistry = class _PersonaRegistry {
  definitions;
  legacyToCanonical;
  constructor(definitions) {
    const canonical = /* @__PURE__ */ new Map();
    const legacy = /* @__PURE__ */ new Map();
    for (const definition of definitions) {
      const parsed = personaManifestSchema.parse(definition.manifest);
      if (canonical.has(parsed.id)) throw new Error(`duplicate canonical PersonaId: ${parsed.id}`);
      const normalized = {
        ...definition,
        id: parsed.id,
        displayName: parsed.displayName,
        status: parsed.status,
        legacyIds: parsed.legacyIds
      };
      assertEntryOwnership(normalized.anecdotes, parsed.id, "anecdotes");
      assertEntryOwnership(normalized.quotes, parsed.id, "quotes");
      assertEntryOwnership(normalized.blacklist, parsed.id, "blacklist");
      canonical.set(parsed.id, normalized);
      for (const legacyId of parsed.legacyIds) {
        if (legacy.has(legacyId) || canonical.has(legacyId)) throw new Error(`duplicate legacy PersonaId: ${legacyId}`);
        legacy.set(legacyId, parsed.id);
      }
    }
    for (const [id] of canonical) {
      if (legacy.has(id)) throw new Error(`canonical PersonaId conflicts with legacy ID: ${id}`);
    }
    this.definitions = canonical;
    this.legacyToCanonical = legacy;
  }
  static fromArtifact(artifact) {
    return new _PersonaRegistry(artifact);
  }
  get(id) {
    const canonical = personaIdSchema.parse(id);
    const definition = this.definitions.get(canonical);
    if (!definition) throw new Error(`unknown PersonaId: ${id}`);
    return definition;
  }
  normalizePersistedId(id) {
    const parsed = personaIdSchema.safeParse(id);
    if (parsed.success && this.definitions.has(parsed.data)) return parsed.data;
    const canonical = this.legacyToCanonical.get(id);
    if (canonical) return canonical;
    throw new Error(`unknown PersonaId: ${id}`);
  }
  listActive() {
    return [...this.definitions.values()].filter((d) => d.manifest.status === "active").sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  }
  list() {
    return [...this.definitions.values()].sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  }
  canCreate(id) {
    return this.get(id).manifest.status === "active";
  }
  requireKnownForRestore(id) {
    return this.get(id);
  }
  requireActiveForCreate(id) {
    const definition = this.get(id);
    if (definition.manifest.status !== "active") throw new Error(`retired PersonaId cannot be created: ${id}`);
    return definition;
  }
  static fromDirectory(rootDir) {
    const root = resolve(rootDir);
    const names = readdirSync(root).filter((name) => statSafe(join(root, name))?.isDirectory()).sort();
    const definitions = names.map((name) => {
      const packageDir = join(root, name);
      const manifestPath = join(packageDir, "manifest.json");
      let manifest;
      try {
        manifest = personaManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
      } catch (error) {
        throw new Error(`invalid persona manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (manifest.id !== name) throw new Error(`manifest id ${manifest.id} does not match package directory ${name}`);
      const promptPath = safeContentPath(packageDir, manifest.content.prompt, "prompt");
      const anecdotesPath = safeContentPath(packageDir, manifest.content.anecdotes, "anecdotes");
      const quotesPath = safeContentPath(packageDir, manifest.content.quotes, "quotes");
      const blacklistPath = safeContentPath(packageDir, manifest.content.blacklist, "blacklist");
      const definition = { manifest, prompt: readFileChecked(promptPath), anecdotes: loadJson(anecdotesPath, "anecdotes"), quotes: loadJson(quotesPath, "quotes"), blacklist: loadJson(blacklistPath, "blacklist") };
      assertEntryOwnership(definition.anecdotes, manifest.id, "anecdotes");
      assertEntryOwnership(definition.quotes, manifest.id, "quotes");
      assertEntryOwnership(definition.blacklist, manifest.id, "blacklist");
      return definition;
    });
    return new _PersonaRegistry(definitions);
  }
};
function readFileChecked(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`missing persona content ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function statSafe(path) {
  try {
    return statSync(path);
  } catch {
    return void 0;
  }
}

// src/persona/generator.ts
function scanPersonaArtifact(rootDir) {
  const registry = PersonaRegistry.fromDirectory(rootDir);
  return registry.list().map((definition) => ({ manifest: definition.manifest, prompt: definition.prompt, anecdotes: definition.anecdotes, quotes: definition.quotes, blacklist: definition.blacklist }));
}
function generateRegistryArtifacts(rootDir) {
  const host = scanPersonaArtifact(rootDir);
  return { host, client: host.filter((entry) => entry.manifest.status === "active").map(({ manifest }) => ({ id: manifest.id, displayName: manifest.displayName, status: manifest.status })) };
}
export {
  generateRegistryArtifacts,
  scanPersonaArtifact
};
//# sourceMappingURL=persona-generator.js.map
