import ShareDB from "sharedb";
import shareDbMongo from "sharedb-mongo";

import {mongoUrl} from "../config";
import {promisify} from 'util'

class ShareDBConnection {
    static instance;
    shareDb;
    connection;

    constructor() {
        this.shareDb = new ShareDB({db: shareDbMongo(mongoUrl)});
        this.connection = this.shareDb.connect()
    }

    static getInstance() {
        if (this.instance == null) this.instance = new ShareDBConnection();
        return this.instance.connection
    }

    static async tearDown() {
        return promisify(this.getInstance().shareDb.close).bind(this.getInstance().shareDb)()
    }
}

export function getShareDB() {
    return ShareDBConnection.getInstance()
}

export async function tearDown() {
    return ShareDBConnection.tearDown()
}