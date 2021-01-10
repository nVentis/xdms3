/**
 * Module supplying a generic exception class that others may extend
 * @module Exceptions/GenericException
 */

/**
 * @description A generic exception
 * @param {string} message
 * @constructor
 */
export default class GenericException {
	/**
	 *
	 * @param {string} message
	 * @param {string} name
	 * @param {string|number|null} code
	 */
	constructor (message, name, code = null) {
		this.message = message;
		this.name = name;
		this.code = code;
		this.content = null;
		this.stack = new Error().stack;

		this.setCode = function (code) {
			this.code = code;
			return this;
		}

		this.setContent = function (content) {
			this.content = content;
			return this;
		}
	}
}