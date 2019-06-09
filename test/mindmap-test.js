import * as chai from "chai";
import {spy} from "sinon";
import {tearDown} from "../src/connection/redis-connection";
import {describe} from "mocha";
import proxyquire from "proxyquire";
import ShareDB from "sharedb";

import chaiAsPromised from "chai-as-promised";
import sinonChai from "sinon-chai";

chai.use(chaiAsPromised);
chai.use(sinonChai);

let mindmap;
const expect = chai.expect;

before(function () {
    mindmap = new (proxyquire('../src/mindmap', {
        './connection/sharedb-connection': {getShareDB: () => new ShareDB().connect()},
        './connection/redis-connection': proxyquire('../src/connection/redis-connection', {
            '../config':
                {redisUrl: 'localhost'}
        })
    }).Mindmap)('test');
});

after(() => {
    tearDown();
});

describe('Mindmap class', function () {
    it('should run normally', async function () {
        const [attach, detach, rename] = [spy(), spy(), spy()];
        mindmap.on('rename', rename);
        mindmap.on('attach', attach);
        mindmap.on('delete', detach);

        await expect(mindmap.subscribe()).to.eventually.deep.equal({name: 'test', nodes: {}});
        console.log('begin subscription');
        const na = await mindmap.attachNewNode([]);
        const na1 = await mindmap.attachNewNode([na]);

        console.log('rename');
        await expect(mindmap.renameNode([na, na1], '', 'na1')).to.be.fulfilled;

        console.log('delete');
        await expect(mindmap.deleteNode([na], '')).to.be.rejectedWith('NotLeafNode');
        await expect(mindmap.deleteNode([na, na1], '')).to.be.rejectedWith('NodeNameNotMatch');
        await expect(mindmap.deleteNode([na, na1], 'na1')).to.be.fulfilled;
        await expect(mindmap.unsubscribe()).to.be.fulfilled;

        expect(attach).to.be.calledTwice;
        expect(rename).to.be.calledWith({path: [na, na1], value: 'na1'});
        expect(detach).to.be.calledWith({path: [na, na1]});
    });
});