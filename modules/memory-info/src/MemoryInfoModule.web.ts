import { registerWebModule, NativeModule } from 'expo';

import { MemoryInfoModuleEvents } from './MemoryInfo.types';

// MemoryInfoModule is not available on the web platform.
class MemoryInfoModule extends NativeModule<MemoryInfoModuleEvents> {}

export default registerWebModule(MemoryInfoModule, 'MemoryInfoModule');
