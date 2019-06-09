import {mongoUrl, redisUrl} from "../config";
import mongoose from "mongoose";
import cachegoose from "cachegoose";

cachegoose(mongoose, {
    engine: 'redis',
    port: 6379,
    host: redisUrl,
});

cachegoose.clearCache(null);

let initialized = false;

async function init() {
    if (!initialized) {
        initialized = true;
        return mongoose.connect(mongoUrl, {useNewUrlParser: true})
    }
}

init();

export async function tearDown() {
    return mongoose.disconnect()
}

export async function paginate(query, limit, cursor, desc = false) {
    // Fetch one more item
    query = query.limit(limit + 1);
    if (desc) query = query.sort({_id: -1});
    if (cursor) {
        query = query.where('_id');
        query = desc ? query.lte(cursor) : query.gte(cursor)
    }
    const result = await query.exec();
    // If the additional item is present, return its id as nextCursor
    if (result.length === limit + 1) return {
        items: result.slice(0, -1),
        nextCursor: result.slice(-1)[0]._id
    };
    // else, return null as nextCursor
    return {items: result, nextCursor: null}
}