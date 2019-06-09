import {promisify} from "util";

export function doAsync(doc) {
    return new Proxy(doc, {
        get(target: *, p: PropertyKey): any {
            if (typeof target[p] === 'function') return promisify(target[p]).bind(target);
            else return target[p]
        }
    });
}