import { User, Snowflake } from 'discord.js';
import Environment from '../providers/Environment';

class Users {
    public static isDeveloper(user: User | Snowflake) {
        if (!Environment.get().DEVELOPERS) return false;

        const developers: Snowflake[] = Environment.get().DEVELOPER_IDS.split(',');
        let userID;

        if (user instanceof User) userID = user.id;
        else userID = user;

        return developers.includes(userID);
    }
}

export default Users;
