/**
 * Module supplying an exception for use in interface-like classes
 * @module Exceptions/InvalidEntityException
 */

import GenericException from "./GenericException.mjs";

/**
 * @description An exception for methods of classes representing interfaces; to be fired when a required method is not implemented
 * @constructor
 */
export default class InvalidEntityException extends GenericException {
	/**
	 * @param {string} message
	 * @param {string} [code=null]
	 */
	constructor(message, code) {
		super(message, "InvalidEntityException", code);
	}
}