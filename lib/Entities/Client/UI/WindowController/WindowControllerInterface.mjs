import NotImplementedException from "../../../Exceptions/NotImplementedException.mjs";

class WindowControllerInterface {
	/**
	 * @returns {HTMLElement}
	 */
	getRootElement () {
		throw new NotImplementedException("getRootElement");
	}

	/**
	 * @returns {Promise<Window>}
	 */
	async getWindow () {
		throw new NotImplementedException("getWindow");
	}

	/**
	 *
	 * @param {string} windowName
	 */
	constructor(
		windowName
	) {
		this.windowName = windowName;
	}

}

export default WindowControllerInterface;