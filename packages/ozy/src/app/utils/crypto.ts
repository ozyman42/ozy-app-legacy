import crypto from 'crypto';
import {v4 as uuid} from 'uuid';

// Influenced by
// https://billatnapier.medium.com/symmetric-key-encryption-with-pbkdf2-and-node-js-846ac57901c1

export function genSalt() {
    const numBytes = Math.floor(Math.random() * 6) + 10;
    return crypto.randomBytes(numBytes).toString('base64');
}

const KEY_SIZE = 32;
const IV_SIZE = 16;
const CIPHER = "aes-256-cbc";
const DIGEST = "sha512";
const ITERATIONS = 100;

export function encrypt(toEncrypt: string, password: string, keySalt: string, ivSalt: string): string {
    const iv = crypto.pbkdf2Sync(password, ivSalt, ITERATIONS, IV_SIZE, DIGEST);
    const key = crypto.pbkdf2Sync(password, keySalt, ITERATIONS, KEY_SIZE, DIGEST);
    const encryptionCipher = crypto.createCipheriv(CIPHER, key, iv);
    const encrypted = Buffer.concat([encryptionCipher.update(toEncrypt, 'utf8'), encryptionCipher.final()]);
    return encrypted.toString('base64');
}

export function decrypt(toDecrypt: string, password: string, keySalt: string, ivSalt: string): string {
    const iv = crypto.pbkdf2Sync(password, ivSalt, ITERATIONS, IV_SIZE, DIGEST);
    const key = crypto.pbkdf2Sync(password, keySalt, ITERATIONS, KEY_SIZE, DIGEST);
    const decryptedCipher = crypto.createDecipheriv(CIPHER, key, iv);
    const decrypted = Buffer.concat([decryptedCipher.update(toDecrypt, 'base64'), decryptedCipher.final()]);
    return decrypted.toString('utf8');
}

export function genUUID() {
    return uuid();
}