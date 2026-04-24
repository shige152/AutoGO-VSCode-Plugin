import { ArtifactStore, ResolvedTool } from '../../services/artifactStore';

export class ResolveAg {
  constructor(private readonly artifactStore: ArtifactStore) {}

  execute(): Promise<ResolvedTool> {
    return this.artifactStore.resolveAg();
  }
}
