/**
 *
 * @module Exceptions/NotFoundException
 */

import GenericException from "./GenericException.mjs";

/**
 * @description Use when an expected ressource is not found
 * @param {string} message
 * @constructor
 */
export default class NotFoundException extends GenericException {
	/**
	 * @param {string} message
	 * @param {string} [code=null]
	 */
	constructor(message, code) {
		super(message, "NotFoundException", code);
	}
}