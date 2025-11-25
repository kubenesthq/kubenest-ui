/**
 * Workload configuration constants
 * Centralizes limits and defaults for workload resources
 */

export const WORKLOAD_LIMITS = {
  /**
   * Minimum number of replicas (can be 0 for scaling down)
   */
  MIN_REPLICAS: 0,

  /**
   * Maximum number of replicas
   */
  MAX_REPLICAS: 10,

  /**
   * Default number of replicas for new workloads
   */
  DEFAULT_REPLICAS: 1,

  /**
   * Minimum valid port number
   */
  MIN_PORT: 1,

  /**
   * Maximum valid port number
   */
  MAX_PORT: 65535,
} as const;

/**
 * Workload build modes
 */
export const BUILD_MODES = {
  IMAGE: 'image',
  GIT: 'git',
  BUILDPACK: 'buildpack',
} as const;

export type BuildMode = typeof BUILD_MODES[keyof typeof BUILD_MODES];
