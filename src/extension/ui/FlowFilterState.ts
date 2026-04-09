// Trace: FEAT-00018-003001, FEAT-00018-003003

export type FlowFilterSortOrder = "default" | "updatedAtDesc";

export interface FlowFilterAuxiliaryFlags {
  hasTrigger: boolean;
  hasSubFlow: boolean;
}

export interface FlowFilterSnapshot {
  query: string;
  requiresTrigger: boolean;
  requiresSubFlow: boolean;
  sortBy: FlowFilterSortOrder;
}

const defaultSnapshot: FlowFilterSnapshot = {
  query: "",
  requiresTrigger: false,
  requiresSubFlow: false,
  sortBy: "default",
};

export class FlowFilterState {
  private snapshot: FlowFilterSnapshot = { ...defaultSnapshot };
  private readonly auxiliaryCache = new Map<string, FlowFilterAuxiliaryFlags>();

  getSnapshot(): FlowFilterSnapshot {
    return { ...this.snapshot };
  }

  update(next: Partial<FlowFilterSnapshot>): boolean {
    const normalizedQuery =
      next.query !== undefined ? next.query.trim() : this.snapshot.query;

    const updatedSnapshot: FlowFilterSnapshot = {
      query: normalizedQuery,
      requiresTrigger: next.requiresTrigger ?? this.snapshot.requiresTrigger,
      requiresSubFlow: next.requiresSubFlow ?? this.snapshot.requiresSubFlow,
      sortBy: next.sortBy ?? this.snapshot.sortBy,
    };

    const changed =
      updatedSnapshot.query !== this.snapshot.query ||
      updatedSnapshot.requiresTrigger !== this.snapshot.requiresTrigger ||
      updatedSnapshot.requiresSubFlow !== this.snapshot.requiresSubFlow ||
      updatedSnapshot.sortBy !== this.snapshot.sortBy;

    if (!changed) {
      return false;
    }

    this.snapshot = updatedSnapshot;
    this.clearAuxiliaryCache();
    return true;
  }

  clear(): boolean {
    const changed = this.isActive();
    this.snapshot = { ...defaultSnapshot };
    this.clearAuxiliaryCache();
    return changed;
  }

  isActive(): boolean {
    return (
      this.snapshot.query.length > 0 ||
      this.snapshot.requiresTrigger ||
      this.snapshot.requiresSubFlow ||
      this.snapshot.sortBy !== "default"
    );
  }

  getAuxiliaryFlags(flowId: string): FlowFilterAuxiliaryFlags | undefined {
    return this.auxiliaryCache.get(flowId);
  }

  setAuxiliaryFlags(flowId: string, flags: FlowFilterAuxiliaryFlags): void {
    this.auxiliaryCache.set(flowId, flags);
  }

  clearAuxiliaryCache(): void {
    this.auxiliaryCache.clear();
  }
}