import {getShareDB} from "../connection/sharedb-connection";
import {addClient, disconnectClient, getLock} from '../connection/redis-connection'
import {getMindmapById} from "./mindmap-meta";
import {EventEmitter} from 'events';
import hat from 'hat';
import {doAsync} from "../util";

const COLLECTION_NAME = 'mindmaps';
const ID_BITS = 12;
const LOCK_TTL = 1000;

function getFromPath(doc, path) {
    let cur = doc;
    // Here we use `some` instead of `forEach` for iteration,
    // due to its breaking in the middle feature
    path.some(item => {
        cur = cur?.nodes?.[item];
        return !cur
    });
    return cur
}

function transformPath(path) {
    return path.reduce((acc, cur) => acc.concat(['nodes', cur]), [])
}

function reversePath(path) {
    return path.filter((_, i) => i % 2 !== 0)
}

function lockResource(mapName, path) {
    return [mapName, ...path].join(':')
}

function generateId() {
    return hat(ID_BITS);
}

export class Mindmap extends EventEmitter {
    doc;
    mindmapId;

    wrappedDoc;

    constructor(mindmapId) {
        super();
        console.log(`New mindmap ${mindmapId} constructed`);
        this.mindmapId = mindmapId;
        this.doc = getShareDB().get(COLLECTION_NAME, mindmapId);
        this.wrappedDoc = doAsync(this.doc);

        this.doc.on("op", ops => {
            ops.forEach(op => {
                console.log('Received op', op);
                const path = reversePath(op.p);
                if (op.p[op.p.length - 1] === 'name' && 'oi' in op && 'od' in op)
                    this.emit('rename', {path, value: op.oi});
                else if ('oi' in op)
                    this.emit('attach', {path});
                else
                    this.emit('delete', {path})
            })
        })
    }

    async subscribe() {
        await addClient(this.mindmapId);
        await this.wrappedDoc.fetch();
        if (this.doc.type === null) {
            const mindmapName = (await getMindmapById(this.mindmapId)).name;
            await this.wrappedDoc.create({name: mindmapName, nodes: {}});
        }
        await this.wrappedDoc.subscribe();
        return this.doc.data
    }

    async unsubscribe() {
        await this.wrappedDoc.destroy();
        return disconnectClient(this.mindmapId)
    }

    async attachNewNode(path) {
        const id = generateId();
        const oi = {name: '', nodes: {}};
        const lock = await this.getLockForPath(path);
        return this.wrappedDoc.submitOp([{p: [...transformPath(path), 'nodes', id], oi}])
            .then(() => id)
            .catch(e => throw e)
            .finally(() => lock.unlock())
    }

    async deleteNode(path, oldName) {
        const lock = await this.getLockForPath(path);
        try {
            const ref = getFromPath(this.doc.data, path);
            if (!ref.nodes) throw 'PathRefNotExists';
            else if (Object.keys(ref.nodes).length !== 0) throw 'NotLeafNode';
            else if (ref.name !== oldName) throw 'NodeNameNotMatch';
            else {
                return this.wrappedDoc.submitOp([{p: transformPath(path), od: ref}])
            }
        } finally {
            lock.unlock()
        }
    }

    async renameNode(path, oldName, newName) {
        const lock = await this.getLockForPath(path);
        try {
            const ref = getFromPath(this.doc.data, path);
            if (ref?.name === oldName)
                return this.wrappedDoc.submitOp(
                    [{p: [...transformPath(path), 'name'], od: oldName, oi: newName}]);
            else
                throw 'NodeNameNotMatch'
        } finally {
            lock.unlock()
        }
    }

    getLockForPath(path) {
        return getLock().lock(lockResource(this.mindmapId, path), LOCK_TTL);
    }


}