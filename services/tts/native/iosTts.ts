import { NativeTtsAdapter } from './nativeTtsAdapter';
import { NativeTtsBridge } from './types';

/** Future bridge maps AVSpeechSynthesizer spoken NSRanges to UTF-16 JS offsets here. */
export class IosNativeTtsAdapter extends NativeTtsAdapter {
  constructor(bridge?: NativeTtsBridge) { super(bridge); }
}
