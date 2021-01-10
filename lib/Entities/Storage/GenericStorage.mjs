/**
 * See class
 * @module Storage/GenericStorage
 */

import NotImplementedException from "../Exceptions/NotImplementedException.mjs";

/**
 * @description A class defining basic key-value interactions that other class may implement
 * @class
 */
export default class GenericStorage {
	/**
	 * @param {string} [Namespace="etc"]
	 */
	constructor(
		Namespace = "etc"
	) {
		this.Namespace = Namespace;
	}

	/**
	 * @param {string} Key
	 * @param {string|array|object} Value
	 * @returns {Promise<boolean,Error>}
	 */
	async Set (Key, Value) {
		throw new NotImplementedException("Set");
	}

	/**
	 * @param {string} Key
	 * @returns {Promise<string|array|object,Error>}
	 */
	async Get (Key) {
		throw new NotImplementedException("Get");
	}

	/**
	 * @param {string} Key
	 * @param {string|array|object} Value
	 * @returns {Promise<boolean,Error>}
	 */
	async Exist (Key) {
		throw new NotImplementedException("Exist");
	}

	/**
	 * @param {string} Key
	 * @param {string|array|object} Value
	 * @returns {Promise<string,Error>}
	 */
	async Key (Value) {
		throw new NotImplementedException("Key");
	}

	/**
	 * @returns {Promise<string[],Error>}
	 */
	async Keys () {
		throw new NotImplementedException("Keys");
	}

	/**
	 * @param {string} Key
	 * @param {string|array|object} Value
	 * @returns {Promise<boolean,Error>}
	 */
	async Remove (Key) {
		throw new NotImplementedException("Remove");
	}

	/**
	 * Saves all content to the storage
	 * @returns {Promise<boolean,Error>}
	 */
	async Save () {
		throw new NotImplementedException("Save");
	}
}