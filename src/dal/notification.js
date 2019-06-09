import '../connection/mongo-connection';
import mongoose from "mongoose";
import {paginate} from "../connection/mongo-connection";

const NotificationSchema = new mongoose.Schema({
    content: String,
    receiver: {type: String, index: true},
    isRead: Boolean,
    meta: String,
});

const Notification = mongoose.model('Notification', NotificationSchema);

export async function createNotification(content, receiver, meta) {
    const notification = new Notification({
        content,
        receiver,
        isRead: false,
        meta,
    });
    return notification.save()
}

export async function getAllNotifications(receiver, limit, cursor, unreadFilter = true) {
    let query = Notification.find({receiver});
    if (unreadFilter) query = query.where('isRead').equals(false);
    return paginate(query, limit, cursor, true)
}

export async function markAsRead(receiver, id) {
    const query = id ? Notification.findById(id) : Notification
        .find({receiver, isRead: false});
    return query
        .setOptions({multi: true})
        .update({isRead: true})
        .exec()
}
