import {RedisPubSub} from "graphql-redis-subscriptions/dist/index";
import Redis from "ioredis";
import {redisUrl} from "../config";
import {createNotification} from "../dal/notification";
import {getMindmapById} from "../dal/mindmap-meta";

const options = {
    host: redisUrl,
    port: 6379
};

export class NotificationPubSub extends RedisPubSub {
    constructor() {
        super({
            publisher: new Redis(options),
            subscriber: new Redis(options),
        })
    }

    async publishNotification(content, receiver, meta) {
        const newNotification = await createNotification(content, receiver, meta);
        return this.publish(receiver, {newNotification})
    }

    async applyToCollaborate(mindmapId, user) {
        const {name, owner} = await getMindmapById(mindmapId);
        return this.publishNotification(
            `User ${user} has applied to collaborate in your mindmap [${name}](mindmap/${mindmapId}). [Approve](addCollaborator/${mindmapId}/${user})`,
            owner)
    }

    async approveApplication(mindmapId, user) {
        const {name, owner} = await getMindmapById(mindmapId);
        return this.publishNotification(
            `The owner (${owner}) of the mindmap [${name}](mindmap/${mindmapId}) has approved your application to collaborate.`,
            user,
            `addCollaborator/${mindmapId}/${name}`
        )
    }
}
