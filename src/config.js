const isProd = process.env['stage'] === 'PROD';
export const mongoUrl = `mongodb://${isProd ? 'mongo' : 'localhost'}:27017/mindmap`;

export const redisUrl = isProd ? 'redis' : 'localhost';

export const corsOrigin = (origin, callback) => callback(!isProd); // Disable cors for prod