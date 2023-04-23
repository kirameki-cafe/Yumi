import { createHmac } from 'crypto';
import Environment from '../providers/Environment';

export default class ImagePorxy {
    public static signImageProxyURL(url: string, modifiers: string | undefined = undefined) {
        const urlSafeBase64 = (string: Buffer) => {
            return Buffer.from(string).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        };

        const hexDecode = (hex: string) => Buffer.from(hex, 'hex');

        const sign = (salt: string, target: string, secret: string) => {
            const hmac = createHmac('sha256', hexDecode(secret));
            hmac.update(hexDecode(salt));
            hmac.update(target);
            return urlSafeBase64(hmac.digest());
        };

        let path;
        if (modifiers) path = `/${modifiers}/plain/${url}`;
        else path = `/plain/${url}`;

        const signature = sign(Environment.get().IMGPROXY_SALT, path, Environment.get().IMGPROXY_KEY);
        const result = `${Environment.get().IMGPROXY_HOST}${signature}${path}`;
        return result;
    }
}
