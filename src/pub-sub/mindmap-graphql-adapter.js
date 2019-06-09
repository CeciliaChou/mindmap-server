import {EventEmitter} from 'events';
import {Mindmap} from "../dal/mindmap";

const MINDMAP_EVENTS = ['attach', 'delete', 'rename'];

export class MindmapGraphqlAdapter extends EventEmitter {

    mindmaps: { [p: string]: [Mindmap, number] } = {};

    constructor() {
        super();
        console.log(`New MindmapAdapter constructed`)
    }

    on(mindmapId: string | symbol, listener: (...args: any[]) => void): this {
        console.log('addListener', mindmapId, 'to', Object.keys(this.mindmaps));
        if (!(mindmapId in this.mindmaps)) {
            const mindmap = new Mindmap(mindmapId);
            this.mindmaps[mindmapId] = [mindmap, 1];
            MINDMAP_EVENTS.forEach(ev => {
                mindmap.on(ev, payload => {
                    console.log('mindmap', mindmapId, 'emitted', ev, payload);
                    this.emit(mindmapId,
                        {
                            subscribe: {
                                __typename: 'Modification',
                                action: ev.toUpperCase(),
                                ...payload
                            }
                        });
                })
            });
        } else {
            this.mindmaps[mindmapId][1]++
        }

        const mindmap = this.mindmaps[mindmapId][0];
        mindmap.subscribe().then(doc => {
            console.log(`Prepare to emit doc, current listeners on ${mindmapId}:`, this.listeners(mindmapId));
            this.emit(mindmapId, {subscribe: {__typename: 'Doc', root: doc}})
        });
        return super.on(mindmapId, listener)
    }

    addListener(mindmapId: string | symbol, listener: (...args: any[]) => void): this {
        return this.on(mindmapId, listener);
    }

    removeListener(mindmapId: string | symbol, listener: (...args: any[]) => void): this {
        console.log(`removeListener ${mindmapId} from ${Object.keys(this.mindmaps)}, count ${this.mindmaps[mindmapId][1]}`);
        const mindmap = this.mindmaps[mindmapId];
        mindmap[1]--;
        if (mindmap[1] === 0) {
            MINDMAP_EVENTS.forEach(ev => mindmap[0].removeAllListeners(ev));
            mindmap[0].unsubscribe();
            delete this.mindmaps[mindmapId]
        }
        return super.removeListener(mindmapId, listener)
    }

    modify(mindmapId, type, ...args) {
        console.log('modifying', mindmapId, 'within', Object.keys(this.mindmaps), type, args);
        const mindmap = this.mindmaps[mindmapId][0];
        return mindmap[type].call(mindmap, ...args)
    }
}