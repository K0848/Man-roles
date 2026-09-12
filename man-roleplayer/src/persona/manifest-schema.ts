import { z } from 'zod'

/** Stable identifier used in persisted data and generated artifacts. */
export const personaIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'PersonaId must be kebab-case')
export type PersonaId = z.infer<typeof personaIdSchema>

export const personaStatusSchema = z.enum(['active', 'retired'])
export type PersonaStatus = z.infer<typeof personaStatusSchema>

export const personaContentManifestSchema = z.object({
  prompt: z.string().min(1),
  anecdotes: z.string().min(1),
  quotes: z.string().min(1),
  blacklist: z.string().min(1),
}).strict()

export const personaManifestSchema = z.object({
  id: personaIdSchema,
  displayName: z.string().min(1),
  status: personaStatusSchema,
  legacyIds: z.array(z.string().min(1)).default([]),
  content: personaContentManifestSchema,
}).strict()
type ParsedPersonaManifest = z.infer<typeof personaManifestSchema>
export type PersonaManifest = Omit<ParsedPersonaManifest, 'legacyIds'> & { readonly legacyIds: readonly string[] }
