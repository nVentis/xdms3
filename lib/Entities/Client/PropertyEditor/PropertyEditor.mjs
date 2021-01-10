/**
 * PropertyType, PropertyEditor, PropertyTypeDayPHP, PropertyTypeObject, PropertyTypeCollection
 * by Bryan Bliewert, 2020
 *
 * Set of classes for manipulating entities
 * Allows type-checking and serialization of an arbitrary number of properties of an arbitrary number of entities
 */

/**
 * A custom property type
 */
class PropertyType {
	/**
	 *
	 * @param {string} typeName
	 * @param {function} Validator - Passed a value that may be checked against this type
	 */
	constructor(
		typeName,
		Validator,
	) {
		typeName = typeName;

		/**
		 * Checks if the given value matches this type
		 * @param someValue
		 * @returns {boolean}
		 */
		this.Validate = function (someValue) {
			return !!Validator(someValue);
		}
	}
}

class PropertyTypeNone extends PropertyType {
	constructor() {
		super("GenericNone", (val) => (val && val instanceof PropertyTypeNone));
	}
}

/**
 * Allows validating and comparing object by using serialization to strings
 * @class
 */
class PropertyTypeObject extends PropertyType {
	constructor () {
		super("GenericObject", (val) => typeof val === "object");

		let This = this;

		/**
		 * @type {PropertyType|string}
		 */
		this.Properties = {};

		/**
		 * @type {Object<string,any>}
		 */
		this.defaultValues = {};

		/**
		 * @type {Object<string, string|number>}
		 */
		this.emptyValues = {};

		/**
		 * Registers a new property for this (otherwise) generic object
		 * @param {string} Name
		 * @param {PropertyType|string} propertyType
		 * @param {string|number [defaultValue]
		 * @param {string|number} [emptyValue]
		 * @returns {PropertyTypeObject}
		 */
		this.defineProperty = function (
			Name,
			propertyType,
			defaultValue,
			emptyValue
		) {
			if (!this.Properties[Name])
				this.Properties[Name] = propertyType;

			if (typeof defaultValue !== "undefined")
				this.defaultValues[Name] = defaultValue;

			if (typeof emptyValue !== "undefined")
				this.emptyValues[Name] = emptyValue;

			return this;
		}

		/**
		 *
		 * @returns {string[]}
		 */
		this.definedPropertyNames = function () {
			return Object.keys(This.Properties);
		}

		/**
		 * @returns {Object<string, PropertyType|string>}
		 */
		this.definedPropertyItems = function () {
			return This.Properties;
		}

		/**
		 * Clone an object matching this type using the default values
		 * @returns {{}}
		 */
		this.createRawDefault = function () {
			let result = Object.assign({}, This.defaultValues);

			return result;
		}

		/**
		 * For deletion of objects, it is neccessary to define an "empty representation"
		 * Per default, we treat completely objects with completely zeroed properties as deleted
		 * @param {Object} someObject
		 */
		this.isEmpty = function (someObject) {
			return (someObject && Object.keys(This.Properties).every((propertyName) => (someObject[propertyName] == (typeof This.emptyValues[propertyName] !== "undefined" ? This.emptyValues[propertyName] : 0)) ));
		}

		/**
		 * Returns an entity representing an empty data structure
		 * @returns {{}}
		 */
		this.getEmpty = function () {
			let emptyEntity = {};

			for (let Property of This.definedPropertyNames())
				emptyEntity[Property] = 0;

			return emptyEntity;
		}

	}
}

/**
 * Allows comparing arrays of items with each other using serialization.
 * If an entityType is set manually, its validation and serialization will be used for all children.
 * @class
 */
class PropertyTypeCollection extends PropertyType {
	/**
	 *
	 * @param {PropertyType|PropertyTypeObject} [entityType] - May also be supplied later with setEntityType
	 */
	constructor(
		entityType = null
	) {
		super("GenericCollection");

		/**
		 * @type {PropertyTypeObject|PropertyType}
		 */
		this.entityType = entityType;

		/**
		 * The maximum amount of children this collection may hold to be validated
		 * @type {number}
		 */
		this.maxMembers = Infinity;

		/**
		 * Assigns this collection the type of entities it will manage. Allows for full-fetched parsing
		 * @param {PropertyTypeObject|PropertyType} propertyType
		 * @returns {PropertyTypeCollection}
		 */
		this.setEntityType = function (propertyType) {
			this.entityType = propertyType;
			return this;
		}

		/**
		 * Returns the currently assigned PropertyType instance
		 * @returns {PropertyTypeObject}
		 */
		this.getEntityType = function () {
			return this.entityType;
		}

		/**
		 * The legacy meaning of "deleting" is setting all properties to 0 :)
		 * @param {array|object} someArrayOrObject
		 * @param {number} itemIndex
		 * @returns {PropertyTypeCollection}
		 */
		this.deleteItem = function (someArrayOrObject, itemIndex) {
			someArrayOrObject[itemIndex] = Object.assign({}, this.entityType.getEmpty());

			return this;
		}

		/**
		 * Set the new maximum
		 * @param {number} aLimit
		 * @returns {PropertyTypeCollection}
		 */
		this.setMaximumMembers = function (aLimit) {
			this.maxMembers = aLimit;

			return this;
		}

		/**
		 * Return the current maximum
		 * @returns {number}
		 */
		this.getMaximumMembers = function () {
			return this.maxMembers;
		}
	}
}

/**
 * Editor for one-dimensional entities e.g. { a: string, b: number, } i.e. no sub-objects!
 * @class
 */
class PropertyEditor {
	/**
	 *
	 * @param {object<string, object>} KeyedEntities
	 */
	constructor(
		KeyedEntities
	) {
		let
			/**
			 * Stores all definedProperty items in propertyName: PropertyType structure
			 * @type {object<string, PropertyType|string>}
			 */
			Properties = {},

			This = this;

		/**
		 * Stores all local edits to entities in entityID: entityEdits structure
		 * entityEdits is an object including only properties which differ from the original entity
		 * @type {object<string, object>}
		 */
		this.Edits = {};

		this.Entities = KeyedEntities;

		/**
		 *
		 * @param {object<string, object>} newKeyedEntities
		 */
		this.setEntities = function (newKeyedEntities) {
			this.Entities = newKeyedEntities;
		}

		this.getEdits = function () {
			return Object.assign({}, this.Edits);
		}

		/**
		 *
		 * @param {string} Name
		 * @param {PropertyType|string} someType
		 * @returns {PropertyEditor}
		 */
		this.defineProperty = function (Name, someType) {
			if (Properties[Name])
				throw new Error(`Property ${Name} already defined`);

			if (!someType || (!(someType instanceof PropertyType) && typeof someType !== "string"))
				throw new Error(`Invalid Property given`);

			Properties[Name] = someType;

			return this;
		}

		/**
		 * Get all definedProperty names
		 * @returns {string[]}
		 */
		this.definedPropertyNames = function () {
			return Object.keys(Properties);
		}

		/**
		 *
		 * @param {string} entityID
		 * @param {string} Property
		 * @param {string|object} newValue - Object is only allowed, if correct diffing is done manually and isDiffed is set to true
		 * @param {boolean} [isDiffed] - Switch to true to do diffing externally
		 * @returns {PropertyEditor}
		 */
		this.Edit = function (
			entityID,
			Property,
			newValue,
			isDiffed = false
		) {
			if (!this.Edits[entityID])
				this.Edits[entityID] = {}

			if (isDiffed) {
				if (newValue === undefined)
					delete this.Edits[entityID][Property];
				else
					this.Edits[entityID][Property] = newValue;

				if (!Object.keys(this.Edits[entityID]).length)
					delete this.Edits[entityID];

				return this;
			}

			// Check if the property matches a definedProperty (see defineProperty)
			if (Properties[Property]) {
				/**
				 * @type {PropertyType}
				 */
				let Type = Properties[Property];
				if (Type.isDiffable()) {
					// If the type has a defined diffing function, use it
					let diffingObject = Type.Diff(this.Entities[entityID][Property], newValue);
					if (!Object.keys(diffingObject).length) {
						delete this.Edits[entityID][Property];

						if (!Object.keys(this.Edits[entityID]).length)
							delete this.Edits[entityID];
					} else {
						this.Edits[entityID][Property] = diffingObject;
					}
				} else {
					// In this case, the stringified values are compared

					if (Type.Serialize(this.Entities[entityID][Property]) === newValue) {
						delete this.Edits[entityID][Property];

						if (!Object.keys(this.Edits[entityID]).length)
							delete this.Edits[entityID];
					} else {
						this.Edits[entityID][Property] = Type.Parse(newValue);
					}
				}
			} else {
				// In this case, it's sufficient to compare the value directly using ===

				// If the entered value is equal to original value, revert saved value
				if (this.Entities[entityID][Property] === newValue) {
					delete this.Edits[entityID][Property];

					// delete user entry from the edits object altogether if there is no other changed value remaining
					if (!Object.keys(this.Edits[entityID]).length)
						delete this.Edits[entityID];
				} else {
					// save edited value
					this.Edits[entityID][Property] = newValue;
				}
			}

			return this;
		}

		/**
		 * Clear the local edits of the given property of the given entity
		 * @param {string} entityID
		 * @param {string} propertyName
		 * @returns {PropertyEditor}
		 */
		this.clearEntityProperty = function (
			entityID,
			propertyName
		) {
			return This.Edit(entityID, propertyName, undefined, true);
		}

		/**
		 * Returns the value of a property merging a potential edit with the original value
		 * @param {string} entityID
		 * @param {string} propertyName
		 * @returns {*}
		 */
		this.getMergedProperty = function (entityID, propertyName) {
			let editedValue = (This.Edits[entityID] && This.Edits[entityID].hasOwnProperty(propertyName)) ? This.Edits[entityID][propertyName] : undefined,
				originalValue = (This.Entities[entityID] && This.Entities[entityID].hasOwnProperty(propertyName)) ? This.Entities[entityID][propertyName] : undefined;

			let returnValue = (editedValue !== undefined) ? editedValue : originalValue;

			if (returnValue !== undefined && Properties[propertyName]) {
				let currentPropertyType = Properties[propertyName];
				if (typeof currentPropertyType === "string") {
					switch (currentPropertyType) {
						case "string":
							return "" + returnValue;

						case "number":
							return + returnValue;

						default:
							return returnValue;
					}
				} else
					throw new Error("Parsing entities using PropertyType is not yet supported");
				// TODO: For objects, iterate through each property and overwrite original values with changes
			} else
				return returnValue;
		}

		/**
		 * Checks whether the entity corresponding to the given ID was edited
		 * @param {string} entityID
		 * @returns {boolean}
		 */
		this.isEdited = function (entityID) {
			return (typeof this.Edits[entityID] !== "undefined");
		}

		/**
		 * Check if the given property of the entity was edited
		 * @param {string} entityID
		 * @param {string} propertyName
		 * @returns {boolean|boolean}
		 */
		this.isEditedProperty = function (entityID, propertyName) {
			return (typeof this.Edits[entityID] !== "undefined" && typeof this.Edits[entityID][propertyName] !== "undefined");
		}

		/**
		 *
		 * @param {string} entityID
		 * @returns {PropertyEditor}
		 */
		this.clearEntity = function (
			entityID
		) {
			delete this.Edits[entityID];

			return this;
		}

		/**
		 *
		 * @returns {PropertyEditor}
		 */
		this.clearFull = function () {
			for (let Property in this.Edits)
				delete this.Edits[Property];

			return this;
		}
	}
}

/**
 * An editor for collections, i.e., arrays whose items do not have a unique ID (the case for many legacy properties)
 * @class
 */
class CollectionEditor {
	/**
	 *
	 * @param {PropertyTypeCollection|null} collectionType
	 * @param {Array} [originalCollection]
	 */
	constructor(
		collectionType = null,
		originalCollection = [],
	) {
		let This = this;

		/**
		 * Stores all local edits to entities in entityIndex: entityEdits structure
		 * entityEdits is an object including only properties which differ from the original entity
		 * @type {object<number, object>}
		 */
		this.Edits = {}

		this.Collection = originalCollection;

		this.Defauls = new Map([
			["editsUndefinedIfEmpty", true] // If true, getEdits will return undefined if Edits is an empty object
		]);

		/**
		 * Better integration is possible when a description of the collection is supplied
		 * May be assigned later using setCollectionType
		 * @type {PropertyTypeCollection}
		 */
		this.collectionType = collectionType;

		/**
		 * Reference to the entity children managed by this Editor
		 * @type {PropertyTypeObject}
		 */
		this.entityType = collectionType.getEntityType();

		/**
		 * Checks if the given entity is empty
		 * If thats the case, it may be deleted from the Edits object
		 * 
		 * @param {object} someEntity
		 * @returns {boolean}
		 */
		let checkEmptyness = (this.entityType ? this.entityType.isEmpty : function (someEntity) {
			return !Object.keys(someEntity).length;
		});

		/**
		 * Defines how a deleted entity may be represented in the Edits object at a given index
		 * @returns {undefined|object}
		 */
		let deletedEntity = (this.entityType ? this.entityType.getEmpty : function () {
			return undefined;
		});

		/**
		 * Stores a deletion of an entity in the edits
		 * @param {number} itemIndex
		 * @returns {CollectionEditor}
		 */
		this.deleteEntity = function (itemIndex) {
			if (checkEmptyness(This.Collection[itemIndex]))
				delete This.Edits[itemIndex];
			else
				This.Edits[itemIndex] = deletedEntity();

			return This;
		}

		/**
		 *
		 * @param {number} collectionIndex
		 * @param {string} Property
		 * @param {string} newValue
		 * @param {boolean} isDiffed
		 * @returns {CollectionEditor}
		 */
		this.Edit = function (
			collectionIndex,
			Property,
			newValue,
			isDiffed = false
		) {
			if (!This.Edits[collectionIndex])
				This.Edits[collectionIndex] = {}

			if (isDiffed) {
				This.Edits[collectionIndex][Property] = newValue;

				if (checkEmptyness(This.Edits[collectionIndex]))
					delete This.Edits[collectionIndex];

				return This;
			}

			// Check if the property matches a definedProperty (see defineProperty)
			if (This.entityType && (typeof This.entityType.Properties[Property] === "object")) {
				// In this case, the stringified values are compared
				/**
				 * @type {PropertyType}
				 */
				let Type = This.entityType.Properties[Property];

				if (Type.Serialize(This.Collection[collectionIndex][Property]) === newValue) {
					delete This.Edits[collectionIndex][Property];

					if (!Object.keys(This.Edits[collectionIndex]).length /* ||checkEmptyness(This.Edits[collectionIndex]) */)
						delete This.Edits[collectionIndex];
				} else {
					this.Edits[collectionIndex][Property] = Type.Parse(newValue);
				}

				// parse newValue using the Parse function
			} else {
				if (This.entityType.Properties[Property]) {
					/**
					 * In this case, a string type was supplied for the field
					 * @type {string}
					 */
					let Type = This.entityType.Properties[Property];

					// Cast type of supplied value
					switch (Type) {
						case "string":
							newValue = "" + newValue;
							break;

						case "number":
							newValue = + newValue;
					}
				} else
					throw new Error(`Undefined property <${Property}>`);

				// If the entered value is equal to original value, revert saved value
				if (This.Collection[collectionIndex][Property] === newValue) {
					delete This.Edits[collectionIndex][Property];

					// delete user entry from the edits object altogether if there is no other changed value remaining
					if (!Object.keys(This.Edits[collectionIndex]).length /*|| checkEmptyness(This.Edits[collectionIndex])*/)
						delete This.Edits[collectionIndex];
				} else {
					// save edited value
					This.Edits[collectionIndex][Property] = newValue;
				}
			}

			return This;
		}

		/**
		 * Returns an array of the original collection merged with the edits
		 * @returns {array}
		 */
		this.getMerged = function () {
			let arrayLikeObject = Object.assign({}, This.Collection, This.getEdits());
				arrayLikeObject.length = Object.keys(arrayLikeObject).length;

				// NEEDS TO BE EDITED FOR EDITING COMPOUND TYPES

			return Array.from(arrayLikeObject);
		}

		/**
		 *
		 * @returns {object<number, object>|undefined}
		 */
		this.getEdits = function () {
			if (Object.keys(This.Edits).length === 0 && This.Defauls.get("editsUndefinedIfEmpty") === true)
				return undefined;

			return Object.assign({}, This.Edits);
		}

		/**
		 *
		 * @returns {boolean}
		 */
		this.isEdited = function () {
			return !!Object.keys(This.Edits).length;
		}

		/**
		 *
		 * @param {array} anyCollection
		 * @returns {CollectionEditor}
		 */
		this.setCollection = function (anyCollection) {
			This.Collection = anyCollection;
			originalCollection = anyCollection;

			return This;
		}

		/**
		 *
		 * @param {PropertyTypeCollection} someCollectionType
		 * @returns {CollectionEditor}
		 */
		this.setCollectionType = function (someCollectionType) {
			This.collectionType = someCollectionType;
			This.entityType = someCollectionType.getEntityType();

			checkEmptyness = This.entityType.isEmpty;
			deletedEntity = This.entityType.getEmpty;

			return This;
		}

		/**
		 *
		 * @returns {PropertyTypeCollection|null}
		 */
		this.getCollectionType = function () {
			return This.collectionType;
		}

		/**
		 * Clears all edits and reverts to the last supplied collection
		 * @returns {CollectionEditor}
		 */
		this.clearFull = function () {
			This.Edits = {};

			This.Collection = originalCollection;

			return This;
		}
	}
}

export default PropertyEditor;
export {
	PropertyType,
	PropertyTypeObject,
	PropertyTypeNone,
	PropertyTypeCollection,
	CollectionEditor
}