/**
 * Module supplying an exception for use in interface-like classes
 * @module Exceptions/UniquenessViolationException
 */

import GenericException from "./GenericException.mjs";

/**
 * @description An exception for when an item that must be unique has already been registered and registering of a new item under the same identifier was issued
 * @param {string} message
 * @constructor
 */
export default class UniquenessViolationException extends GenericException {
	/**
	 * @param {string} message
	 * @param {string} [code=null]
	 */
	constructor(message, code) {
		super(message, "UniquenessViolationException", code);
	}
}