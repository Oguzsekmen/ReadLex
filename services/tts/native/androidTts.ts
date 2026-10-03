import { NativeTtsAdapter } from './nativeTtsAdapter';
import { NativeTtsBridge } from './types';

/** Future bridge maps Android TextToSpeech UtteranceProgressListener ranges here. */
export class AndroidNativeTtsAdapter extends NativeTtsAdapter {
  constructor(bridge?: NativeTtsBridge) { super(bridge); }
}
