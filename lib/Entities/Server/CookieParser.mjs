class CookieParser {
	constructor(

	) {

	}

	/**
	 * Converts a HTTP cookie string to a key-value object
	 * @param cookieString
	 * @returns {object}
	 */
	Parse (cookieString) {
		let res = {};
		let cookieEntries = cookieString.split("; ");
		for (let cookieEntry of cookieEntries) {
			let cookieKeyValue = cookieEntry.split("=");
			res[cookieKeyValue[0]] = cookieKeyValue[1];
		}

		return res;
	}
}

export default CookieParser;