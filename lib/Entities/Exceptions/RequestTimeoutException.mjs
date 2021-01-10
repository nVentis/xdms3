/**
 * Module supplying an exception for use when a required ressource can not be retrieved in time
 * @module Exceptions/RequestTimeoutException
 */

import GenericException from "./GenericException.mjs";

/**
 * @description An exception for use when a required ressource can not be retrieved in time
 * @param {string} message
 * @constructor
 */
export default class RequestTimeoutException extends GenericException {
	/**
	 * @param {string} message
	 * @param {string} [code=null]
	 */
	constructor(message, code) {
		super(message, "RequestTimeoutException", code);
	}
}