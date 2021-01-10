/**
 * Module supplying an exception for use in interface-like classes
 * @module Exceptions/InvalidTypeException
 */

import GenericException from "./GenericException.mjs";

/**
 * @description An exception for use when a value does not fit the specification
 * @param {string} message
 * @constructor
 */
export default class InvalidTypeException extends GenericException {
	/**
	 * @param {string} message
	 * @param {string} [code=null]
	 */
	constructor(message, code) {
		super(message, "InvalidTypeException", code);
	}
}