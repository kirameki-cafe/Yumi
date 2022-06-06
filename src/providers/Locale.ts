import { I18n } from 'i18n';
import * as path from 'path';
import Logger from '../libs/Logger';

class Locale {
    public localePath: string;

    constructor() {
        this.localePath = path.join(process.cwd(), 'locales/');
    }

    public init(): void {
        Logger.log('info', 'Loaded locales: ' + this.getLocaleProvider("en").getLocales().join(', '));
    }

    public getLocaleProvider(locale: string) {
        const i18n = new I18n();
        i18n.configure({
            directory: this.localePath
        })
        i18n.setLocale(locale);
        return i18n;
    }

}

export default new Locale();