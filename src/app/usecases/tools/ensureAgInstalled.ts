import { ArtifactStore, ResolvedTool } from '../../services/artifactStore';

export class EnsureAgInstalled {
  constructor(private readonly artifactStore: ArtifactStore) {}

  execute(): Promise<ResolvedTool> {
    return this.artifactStore.ensureAgInstalled();
  }
}
