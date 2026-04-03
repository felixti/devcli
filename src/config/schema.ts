import { z } from "zod";

/**
 * Zod schema for remote config validation.
 * Remote config format: { version: string, tools: Array<{ name, displayName, minVersion?, installMethod? }> }
 */
export const ToolSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  minVersion: z.string().optional(),
  installMethod: z.string().optional(),
});

export const RemoteConfigSchema = z.object({
  version: z.string().min(1),
  tools: z.array(ToolSchema).min(1),
});

/**
 * Inferred type from RemoteConfigSchema.
 * Use this for type-safe access to remote config.
 */
export type RemoteConfig = z.infer<typeof RemoteConfigSchema>;
export type ToolConfig = z.infer<typeof ToolSchema>;