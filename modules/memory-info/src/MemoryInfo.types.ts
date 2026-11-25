export type MemorySnapshot = {
  /** RAM this app is using right now (Android: PSS, iOS: phys_footprint). */
  appUsedBytes: number;
  /** Android: free RAM on the device. iOS: how much more this app may use. */
  availableBytes: number;
  /** Total physical RAM on the device. */
  totalBytes: number;
  /** Android: the system considers itself low on memory. Always false on iOS. */
  lowMemory: boolean;
};

export type MemoryPressureEvent = {
  /** Android ComponentCallbacks2 trim level (iOS memory warnings report 15). */
  level: number;
  /** True when the OS is close to killing apps — release big allocations now. */
  critical: boolean;
};

export type MemoryInfoModuleEvents = {
  onMemoryPressure: (event: MemoryPressureEvent) => void;
};
