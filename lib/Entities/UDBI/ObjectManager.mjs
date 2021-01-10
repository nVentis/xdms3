/**
 * Interfaces for the ObjectManager for storing/fetching/managing entities
 * @module UDBI/ObjectManager
 */

import NotImplementedException from "../Exceptions/NotImplementedException.mjs";
import { UDBIDatabase } from "./Core.mjs";
import ConfigCurrent from "../Config/ConfigCurrent.mjs";

/**
 * Interface of ObjectRepository for nVentis UDBI
 * @class
 */
class ObjectRepository {
	/**
	 *
	 * @param {ObjectManager} objectManager
	 */
	constructor(objectManager) {
		this.objectManager = objectManager;
	}

	/**
	 *
	 * @param whereArgs
	 * @returns {Promise<void>}
	 */
	async findBy (...whereArgs) {
		throw new NotImplementedException("findBy");
	}

	async Init () {
		if (ConfigCurrent.devMode)
			console.warn(`Warning: Using default repository implementation <${this.objectManager.Name}>`);

		return true;
	}
}

/**
 * Interface of ObjectManager for nVentis UDBI
 * Copyright 2020 by nVentis (SM), Bryan Bliewert
 * @class
 */

class ObjectManager {
	/**
	 *
	 * @param {function} ManagedEntity
	 */
	constructor(
		ManagedEntity,
		Name
	) {
		this.ManagedEntity = ManagedEntity;

		/**
		 * Name of the ManagedEntity and name of the created store
		 * @type {*|string}
		 */
		this.Name = Name || ManagedEntity.name;

		/**
		 * Readies this ObjectManager
		 * @param {UDBIDatabase|undefined} UDBIDatabaseInstance
		 * @returns {Promise<ObjectManager>}
		 */
		this.Request = async function (UDBIDatabaseInstance) {
			throw new NotImplementedException("Request");
		}
	}

	/**
	 * Get the repository responsible for managing a certain object
	 * @param {string} entityName
	 * @returns {ObjectRepository}
	 */
	async getRepository(entityName){
		throw new NotImplementedException("getRepository");
	}

	/**
	 * Save a managableObject in the database and returns a managedObject
	 * @param object{} managableObject
	 * @returns {object}
	 */
	async Persist(managableObject){
		throw new NotImplementedException("Persist");
	}

	/**
	 * Remove a managedObject from the database
	 * @param managedObject
	 * @returns {Promise<boolean,Error>}
	 */
	async Remove(managedObject){
		throw new NotImplementedException("Remove");
	}

	/**
	 *
	 * @constructor
	 */
	Query() {
		throw new NotImplementedException("Query");
	}

	async resolveQuery(
		Query
	){
		throw new NotImplementedException("resolveQuery");
	}

	/**
	 * Fetches all objects matching Target as well as the optional arguments
	 * @param {object} Target - Target object of structure { propertyName1: value1, propertyName2: value2,... }; conditional AND
	 * @param {object} [orderDesc] - Order object of structure { propertyName: "ASC/DESC" }
	 * @param {number} [Limit] - Maximum number of objects to fetch
	 * @param {boolean} [getPrimaryKeyOnly=false]
	 * @returns {object[]}
	 */
	async findBy(
		Target,
		orderDesc,
		Limit,
		getPrimaryKeyOnly = false){
		throw new NotImplementedException("findBy");
	}

	/**
	 * Updates all changes and write to the database
	 * @returns {Promise<boolean,Error>}
	 * @constructor
	 */
	async Flush(){
		throw new NotImplementedException("Flush");
	}
}

export {
	ObjectManager,
	ObjectRepository
}