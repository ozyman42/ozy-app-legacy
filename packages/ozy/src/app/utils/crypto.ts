import crypto from 'crypto';

export function hash(contents: string): string {
    return crypto.createHash("sha256").update(contents).digest('base64');
}