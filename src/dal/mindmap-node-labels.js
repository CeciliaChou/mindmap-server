import '../connection/mongo-connection';
import mongoose from 'mongoose';

const MindmapNodeLabelsSchema = new mongoose.Schema({
    mindmapId: mongoose.Schema.Types.ObjectId,
    path: String,
    labels: [String],
});

MindmapNodeLabelsSchema.index({mindmapId: 1, path: 1});

const MindmapNodeLabels = mongoose.model(
    'MindmapNodeLabels', MindmapNodeLabelsSchema);

export async function associateNodeWithLabel(mindmapId, path, labelId) {
    const mindmapNode = await MindmapNodeLabels
        .findOneAndUpdate({mindmapId, path: path.join('_')}, {}, {upsert: true, 'new': true})
        .exec();
    if (mindmapNode.labels)
        mindmapNode.labels.push(labelId);
    else mindmapNode.labels = [labelId];
    return mindmapNode.save()
}

export async function disassociateNodeWithLabel(mindmapId, path, labelId) {
    const mindmapNode = await MindmapNodeLabels.findOne({mindmapId, path: path.join('_')});
    if (!mindmapNode) return [];
    const index = mindmapNode.labels.findIndex(l => l === labelId);
    if (index === -1) return [];
    const result = mindmapNode.labels.splice(index, 1);
    await mindmapNode.save();
    return result
}

export async function getNodeAssociatedLabels(mindmapId, path) {
    return MindmapNodeLabels
        .findOneAndUpdate({mindmapId, path: path.join('_')}, {}, {upsert: true, 'new': true})
        .exec()
        .then(({labels}) => labels || [])
}
