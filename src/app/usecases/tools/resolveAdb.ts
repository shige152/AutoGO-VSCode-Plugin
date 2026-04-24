import { ArtifactStore, ResolvedTool } from '../../services/artifactStore';
import { Settings } from '../../ports/settings';

export class ResolveAdb {
  constructor(
    private readonly artifactStore: ArtifactStore,
    private readonly settings: Settings,
  ) {}

  execute(): Promise<ResolvedTool> {
    return this.artifactStore.resolveAdb(this.settings);
  }
}
