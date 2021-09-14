import { PrismaClient } from '@prisma/client';

class Prisma {

    public client: PrismaClient;

    constructor () {
        this.client = new PrismaClient;
    }

    public init(): void {
        this.client = new PrismaClient();
    }

    public end(): void {
        this.client.$disconnect();
    }

}

export default new Prisma();