import { ArtifactStore } from '../../app/services/artifactStore';

export interface AgPathResolver {
  getCached(): string | null;
  resolve(): Promise<string | null>;
}

export function createAgPathResolver(
  artifactStore: ArtifactStore,
  onResolveError: () => void,
): AgPathResolver {
  let cachedAgPath: string | null = null;

  async function resolve(): Promise<string | null> {
    try {
      const resolved = await artifactStore.resolveAg();
      cachedAgPath = resolved.path;
      return resolved.path;
    } catch (error) {
      cachedAgPath = null;
      onResolveError();
      return null;
    }
  }

  return {
    getCached: () => cachedAgPath,
    resolve,
  };
}
