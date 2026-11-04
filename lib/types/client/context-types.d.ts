/** DSH 0.2.x client contracts consumed by the browser half. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { zh } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'voice.announcer': keyof typeof zh;
    }
}
export type Context = ClientContext;
