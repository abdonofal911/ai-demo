import { NativeModule, requireNativeModule } from 'expo';

import type { MemoryInfoModuleEvents, MemorySnapshot } from './MemoryInfo.types';

declare class MemoryInfoModule extends NativeModule<MemoryInfoModuleEvents> {
  getMemoryAsync(): Promise<MemorySnapshot>;
}

export default requireNativeModule<MemoryInfoModule>('MemoryInfo');
