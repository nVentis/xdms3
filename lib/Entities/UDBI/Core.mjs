/**
 * Interfaces for the nVentis Universal Database Interface
 * @module UDBI/Core
 */

import NotImplementedException from "../Exceptions/NotImplementedException.mjs";
import FieldTypeBigInteger from "./FieldTypes/FieldTypeBigInteger.mjs";
import FieldTypeFloat from "./FieldTypes/FieldTypeFloat.mjs";
import FieldTypeInteger from "./FieldTypes/FieldTypeInteger.mjs";
import FieldTypeString from "./FieldTypes/FieldTypeString.mjs";
import FieldTypeText from "./FieldTypes/FieldTypeText.mjs";
import FieldTypeTimestamp from "./FieldTypes/FieldTypeTimestamp.mjs";
import FieldTypeGeneric from "./FieldTypes/FieldTypeGeneric.mjs";

/**
 * Provider Interface for nVentis UDBI
 * Copyright 2020 by nVentis (SM), Bryan Bliewert
 * @class
 */
class UDBIDatabase {
	/**
	 *
	 * @param {string} dbName
	 */
	constructor(
		dbName
	) {
		this.dbName = dbName;

		this.Config = {
			Persistence: true, // set by storageProvider
			saveOn: {
				Write: true,
				Delete: true,
				Update: true
			}
		}
	}
	/*
	Config = {
		Persistence: true, // set by storageProvider
		saveOn: {
			Write: true,
			Delete: true,
			Update: true
		}
	}*/
}


/**
 * Interface of UDBI.Table
 * @class
 */
class UDBITable {
	/**
	 * @description A generic UDBI database table
	 * @constructor
	 * @param {string} tableName
	 */
	constructor(tableName) {
		this.Name = tableName;
	}

	/**
	 * @description Read rows from an UDBI database table
	 * @param {array|string} Column
	 * @param {array|string} [Target]
	 * @param {number} [Limit]
	 * @param {string} [Order="desc"]
	 * @returns {Promise<Object>}
	 */
	Read(Column, Target, Limit, Order) {
		throw new NotImplementedException("Read");
	}

	/**
	 * @description Writes rows of data fitting to this table
	 * @param {[Object]} Values
	 * @returns {Promise<Object>}
	 */
	Write(Values) {
		throw new NotImplementedException("Write");
	}

	/**
	 * @description Updates the table according to the supplied values
	 * @param {array|string} Target
	 * @param {array} Values
	 * @returns {Promise<Object>}
	 */
	Update(Target, Values) {
		throw new NotImplementedException("Update");
	}

	/**
	 * @description Checks if a given entry exists
	 * @param {array|string} Target
	 * @param Action - Non standard
	 * @param iterateAll - Non standard
	 * @returns {Promise<boolean>}
	 */
	Exist(Target, Action, iterateAll) {
		throw new NotImplementedException("Exist");
	}

	/**
	 * @description Delete the specified entries
	 * @param Target
	 * @param deleteAll
	 * @returns {Promise<Object>}
	 */
	Delete(Target, deleteAll) {
		throw new NotImplementedException("Delete");
	}

	/**
	 *
	 * @param Type
	 * @param Column
	 * @returns {Promise<Object>}
	 */
	Calculate(Type, Column) {
		throw new NotImplementedException("Calculate");
	}

	/**
	 * @description Count the number of rows which fit to the request
	 * @param {array|string} Target
	 * @returns {Promise<number>}
	 */
	Count(Target) {
		throw new NotImplementedException("Count");
	}

	/**
	 * @description Deletes all rows of this table
	 * @returns {Promise<Object>}
	 */
	Clear() {
		throw new NotImplementedException("Clear");
	}

	/**
	 * @description Deletes all table content and itself from the database
	 * @param {boolean} [confirmWithTrue=false] - Must manually be set true
	 * @returns {Promise<Object>}
	 */
	Drop(confirmWithTrue) {
		throw new NotImplementedException("Drop");
	}

	/**
	 * @description Retrieve the total number of rows in the table
	 * @returns {Promise<number>}
	 */
	Length() {
		throw new NotImplementedException("Length");
	}
}

/**
 * Used for defining table models for relational databases to store entity classes
 * See e.g. MySQL adapter for usage
 * This is unlike Object stores such as Indexed DB, where entities are stored "as is"
 * @class
 */
class UDBITableSchema {
	/**
	 *
	 * @param {FieldTypeGeneric[]} fieldTypeList
	 * @param {function} [managedEntity]
	 * @param {object} [Options] - Implementation (driver) specific options may be given here
	 * @param {string} [Options.Name]
	 * @param {object[]} [Options.Base] - Base entities to insert after first install; array of insertGraph objects (see Objection)
	 * @param {function} [Options.baseInit] - An (async) function(Base) to be called before Base injection; results will be injected instead
	 */
	constructor(
		fieldTypeList,
		managedEntity,
		Options = {}
	) {
		this.fieldTypes = fieldTypeList;
		this.managedEntity = managedEntity;

		this.Options = Options;
	}
}

export {
	UDBIDatabase, UDBITable, UDBITableSchema
}