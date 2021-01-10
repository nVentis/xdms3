/**
 *
 * @module Exceptions/UnexpectedIdentifierException
 */

import GenericException from "./GenericException.mjs";

/**
 * @description An exception for when a given identifier is unknown
 * @param {string} message
 * @constructor
 */
export default class UnexpectedIdentifierException extends GenericException {
	/**
	 * @param {string} message
	 * @param {string} [code=null]
	 */
	constructor(message, code) {
		super(message, "UnexpectedIdentifierException", code);
	}
}