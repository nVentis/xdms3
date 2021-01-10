/**
 * Module supplying an exception for use in interface-like classes
 * @module Exceptions/AccessDeniedException
 */

import GenericException from "./GenericException.mjs";

/**
 * @description Used when the current user does not have the required rights to access a resource
 * @constructor
 */
export default class AccessDeniedException extends GenericException {
	/**
	 * @param {string} message
	 * @param {string} [code=null]
	 */
	constructor(
		message = "Access denied",
		code = "EACCESSDENIED"
	) {
		super(message, "AccessDeniedException", code);
	}
}