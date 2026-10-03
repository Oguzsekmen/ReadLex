import { getAppPlatform, AppPlatform } from '../../native/platform';
import { ReaderTtsAdapter } from '../types';
import { WebSpeechTtsAdapter } from '../webSpeechTts';
import { AndroidNativeTtsAdapter } from './androidTts';
import { IosNativeTtsAdapter } from './iosTts';
import { NativeTtsBridge } from './types';

export type NativeTtsBridges = { android?: NativeTtsBridge; ios?: NativeTtsBridge };

/** Select once at initialization; Reader code remains platform-agnostic. */
export const createReaderTtsAdapter = ({
  platform = getAppPlatform(),
  bridges = {},
  web = new WebSpeechTtsAdapter()
}: { platform?: AppPlatform; bridges?: NativeTtsBridges; web?: ReaderTtsAdapter } = {}): ReaderTtsAdapter => {
  const native = platform === 'android' ? new AndroidNativeTtsAdapter(bridges.android) : platform === 'ios' ? new IosNativeTtsAdapter(bridges.ios) : undefined;
  if (native?.isSupported()) return native;
  return web;
};
