// TODO: Allow supplying get/post/patch/delete/etc.. methods here
// In view, only reference methods supplied by abstract editor items

import {PropertyTypeObject} from "./PropertyType.mjs";
import NotImplementedException from "../../Exceptions/NotImplementedException.mjs";

/**
 * Allows defining async actions for interaction with controllers
 * Actions may be defined regardless of transport mechanism (REST, Socket.IO etc.)
 *
 * @interface
 */
class SyncedPropertyTypeObjectInterface extends PropertyTypeObject {
	/**
	 *
	 * @param {string} idProperty
	 * @param {string} Name
	 */
	constructor(
    	idProperty,
		Name
	) {
		super(idProperty, Name);
	}

	/**
	 *
	 * @param {number} someId
	 * @returns {Promise<object>}
	 */
	static async fetchById (
		someId
	) {
		throw new NotImplementedException("fetchById");
	}

	/**
	 *
	 * @param {string} searchTerm
	 * @param {object} [searchOptions] - Typically includes a searchLimit number
	 * @returns {Promise<object[]>}
	 */
	static async fetchBySearch (
		searchTerm,
		searchOptions
	) {
		throw new NotImplementedException("fetchBySearch");
	}

	/**
	 *
	 * @param {object} someEntity - Must posses an idProperty field
	 * @returns {Promise<boolean>}
	 */
	static async Delete (
		someEntity
	) {
		throw new NotImplementedException("Delete");
	}

	/**
	 *
	 * @param {object} someEntity - Must posses an idProperty field
	 * @returns {Promise<object>} - The updated entity instance
	 */
	static async Update (
		someEntity
	) {
		throw new NotImplementedException("Update");
	}

	/**
	 *
	 * @param {object} someEntity
	 * @returns {Promise<object>} - The inserted entity instance
	 */
	static async Insert (
		someEntity
	) {
		throw new NotImplementedException("Insert");
	}
}

export default SyncedPropertyTypeObjectInterface;