import '../connection/mongo-connection';
import mongoose from 'mongoose';

const UserPrefsSchema = new mongoose.Schema({
    githubId: {type: String, index: true},
    subscribeLabels: [String],
});

const UserPrefs = mongoose.model('UserPrefs', UserPrefsSchema);

export async function subscribeToLabel(githubId, labelId) {
    const user = await UserPrefs
        .findOneAndUpdate({githubId}, {}, {upsert: true, 'new': true})
        .exec();
    user.subscribeLabels.push(labelId);
    return user.save()
}

export async function unsubscribeToLabel(githubId, labelId) {
    const user = await UserPrefs.findOne({githubId});
    if (!user) return [];
    const index = user.subscribeLabels.findIndex(l => l === labelId);
    if (index === -1) return [];
    const result = user.subscribeLabels.splice(index, 1);
    await user.save();
    return result
}

export async function getSubscribedLabels(githubId) {
    return UserPrefs
        .findOneAndUpdate({githubId}, {}, {upsert: true, 'new': true})
        .exec()
        .then(({subscribeLabels}) => subscribeLabels)
}
