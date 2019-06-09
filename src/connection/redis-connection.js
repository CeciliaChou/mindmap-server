import redis from 'redis';
import {redisUrl} from "../config";
import {doAsync} from "../util";
import RedLock from 'redlock';

const REDIS_PORT = 6379;

class RedisConnection {
    static instance;
    connection;
    wrappedConnection;
    lock;

    constructor() {
        this.connection = redis.createClient(REDIS_PORT, redisUrl);
        this.wrappedConnection = doAsync(this.connection);
        this.lock = new RedLock([this.connection])
    }

    static getInstance() {
        if (this.instance == null) this.instance = new RedisConnection();
        return this.instance
    }

    static getConnection() {
        return this.getInstance().connection
    }

    static getLock() {
        return this.getInstance().lock
    }
}

function connectedClientsKey(mindmap) {
    return `mindmap:${mindmap}:connected`
}

export async function getConnectionClients(mindmap) {
    return RedisConnection.getConnection().get(connectedClientsKey(mindmap))
}

export async function addClient(mindmap) {
    return RedisConnection.getConnection().incr(connectedClientsKey(mindmap))
}

export async function disconnectClient(mindmap) {
    return RedisConnection.getConnection().decr(connectedClientsKey(mindmap))
}

export function getLock() {
    return RedisConnection.getLock()
}

export function tearDown() {
    RedisConnection.getConnection().quit()
}