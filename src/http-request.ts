import { App } from './app';
import { HttpRequest as BaseHttpRequest } from 'uWebSockets.js';

export interface HttpRequest extends BaseHttpRequest {
    /**
     * The attached Echo App.
     */
    app?: App;

    /**
     * The raw body (as undecoded JSON).
     */
    rawBody?: string;
}
