export default class StringUtils {
    public static numberWithCommas(x: Number) {
        try {
            return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        } catch (err) {
            return x;
        }
    }
}
