import "../connection/mongo-connection";
import cachegoose from "cachegoose";
import mongoose from "mongoose";
import {paginate} from "../connection/mongo-connection";

function getMindmapCacheKey(mapId) {
    return `getMindmap:${mapId}`
}

const MindmapMetaSchema = new mongoose.Schema({
    name: String,
    users: {type: [{id: String, role: String}], index: true}
});
MindmapMetaSchema.index({name: 'text'});
const MindmapMeta = mongoose.model('MindmapMeta', MindmapMetaSchema);

// Extracts 'owner' from mindmap
const getOwnerAggregations = [
    {
        $project: {
            _id: "$_id",
            name: 1,
            users: 1,
            user: {$arrayElemAt: [{$filter: {input: "$users", as: "user", cond: {$eq: ["$$user.role", "owner"]}}}, 0]}
        }
    },
    {$project: {_id: "$_id", name: 1, users: 1, owner: "$user.id"}}];

function aggregationOperations(...firstOper) {
    return [...firstOper.map(oper => ({$match: oper})), ...getOwnerAggregations]
}

export async function getMindmapById(mapId) {
    // This could be done by simply calling findById
    // But in order to return owner as well, it had to be done with aggregation
    return MindmapMeta.aggregate(
        aggregationOperations({_id: mongoose.Types.ObjectId(mapId)}))
        .cache(0, getMindmapCacheKey(mapId))
        .exec()
        .then(([map]) => {
            if (!map) throw '';
            return map;
        })
}

export async function createMindmap(name, userId) {
    const newMindmap = new MindmapMeta({
        name,
        users: [{id: userId, role: 'owner'}]
    });
    return newMindmap.save().then((doc) => {
        cachegoose.clearCache(getMindmapCacheKey(doc._id));
        return doc
    })
}

export async function addToMindmap(mapId, userId) {
    const mindmap = await MindmapMeta.findById(mapId).exec();
    cachegoose.clearCache(getMindmapCacheKey(mapId));
    mindmap.users.push({id: userId, role: 'collaborator'});
    return mindmap.save()
}

export async function listMindmapsByUser(userId, limit, cursor, roles) {
    const query = MindmapMeta
        .aggregate(aggregationOperations({
            users: {$elemMatch: {id: userId, role: {$in: roles}}}
        }));
    return await paginate(query, limit, cursor)
}

export async function searchMindmaps(text, limit, cursor) {
    const query = MindmapMeta.aggregate(aggregationOperations({$text: {$search: text}}));
    return await paginate(query, limit, cursor)
}