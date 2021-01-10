import InvalidTypeException from "../../Exceptions/InvalidTypeException.mjs";
import ConfigCurrent from "../../Config/ConfigCurrent.mjs";
import NotImplementedException from "../../Exceptions/NotImplementedException.mjs";
import InvalidStateException from "../../Exceptions/InvalidStateException.mjs";

import PropertyConstraint, {PropertyConstraintAttached} from "./PropertyConstraint.mjs";
import PropertyType, {PropertyTypeObject,PropertyTypeCollection,PropertyTypeNone,IS_TEMPLATE_PROPERTY_NAME} from "./PropertyType.mjs";
import EntityStorageCollection from "./EntityStorageCollection.mjs";
import mergeDeep from "../../Core/mergeDeep.mjs";
import IDGenerator from "../../Core/IDGenerator.mjs";

/**
 * Returned when EntityStorage.allowParallelEdits is false and a parallel edit is attempted
 * i. e. some property has been changed and there is an attempt to change ANOTHER property
 */
export class IllegalParallelEditException extends Error {}

export const ENTITY_COMPARISON_STRATEGIES = {
	DEEP_SIMPLE: "DEEP_SIMPLE"
}

export const DELTA_MERGE_STRATEGIES = {
	DEEP_SIMPLE: "DEEP_SIMPLE" // Changes are merged with the respective original items
}

export const ENTITY_STATE_ENUMERATIONS = {
	UPDATED: "UPDATED",
	INSERTED: "INSERTED",
	DELETED: "DELETED",
};

export const STORE_ACTION_TYPE_ENUMERATION = {
	UPDATE: "UPDATE", // the default. Will attempt to find the expected behavior automatically (if an entry exists, does not exist, etc., do different things)
						// when an existing property is changed, it is applied the UPDATED _STATE property
	REJECT: "REJECT", // delete local changes
	DELETE: "DELETE", // delete an item (marks it with the DELETED _STATE property in the Edits object)
	INSERT: "INSERT", // insert a new item, e.g. to a collection (marks it with the INSERTED _STATE property as well)
	MERGE: "MERGE", // merges edited and original values
	//ATTACH: "ATTACH", // attach an entity to a relation
	//DETACH: "DETACH", // remove an entity from a relation/collection
	// As of 14.11.2020: How the server handles relations may not be relevant (attaching/detaching); the correct behavior will be be given by the id of the edited entity
	// 	if the id is the same as before and the entity is in an UPDATED state, the current entity will be be updated; if it's different, the previous entity will be
	//  detached, the one with the given Id attached and, if other properties are set as well, they are edited aswell
}

/**
 * Basically a non-indexed, temporary data storage for working with nested objects with defined structure
 */
class EntityStorage {
	/**
	 * Controls if a completely new Edits array will be returned when using getEdits()
	 * @type {boolean}
	 */
	Immutability = false;

	/**
	 * When the value of a mapped relation is Edit(ed) to this value, the server may interpret it as dropping the relation
	 * @type {null}
	 */
	detachedProperty = null;

	/**
	 * The storageCollection this instance belongs to. Will default to rootEntityStorageCollection
	 * @type {EntityStorageCollection}
	 */
	storageCollection = null;

	/**
	 * Subsequent calls to Edit() will throw an IllegalParallelEditException() after a certain property has been edited
	 * and there is an attempt to edit ANOTHER property
	 * Performs checks against lastEditedLocation
	 * @type {boolean}
	 */
	allowParallelEdits = true;

	/**
	 *
	 * @type {null|string}
	 */
	lastEditedLocation = null;

	/**
	 * Stores entity data and allows editing that; edits are stored by diffing to the original entity collection
	 * Per default, there is only one editor instance per PropertyTypeCollection. This is intended to keep cross-references between
	 *  different editor instances consistent.
	 * Changes will always be checked against the root of the given PropertyType, i.e., for instances of connected PropertyType items,
	 *  editing an item in one editor will not create edit entries in editor instances of connected PropertyType items
	 * @param {PropertyTypeCollection} collectionType
	 * @param {any[]} originalCollection
	 * @param {EntityStorageCollection|null} entityStorageCollection - Used for resolving aliases. Defaults to root EntityStorageCollection
	 */
	constructor(
		collectionType,
		originalCollection = [],
		entityStorageCollection = null
	) {
		if (!entityStorageCollection)
			entityStorageCollection = rootEntityStorageCollection;

		if (entityStorageCollection.Storages[collectionType.typeName])
			return entityStorageCollection.Storages[collectionType.typeName];

		if (!(collectionType.prototype instanceof PropertyTypeCollection) || !(collectionType.entityType.prototype instanceof PropertyTypeObject))
			throw new InvalidTypeException("collectionType");

		// Compile all object/collection types here
		let compile = function (propertyType) {
			if (propertyType) {
				//console.log(`Compiling <${propertyType.name}>`);

				if (propertyType.prototype instanceof PropertyTypeCollection) {
					propertyType.compile();
					compile(propertyType.entityType);
				} else if (propertyType.prototype instanceof PropertyTypeObject) {
					propertyType.compile();
					for (let propertyName in propertyType.Properties)
						compile(propertyType.Properties[propertyName]);
				}
			}
		}
		compile(collectionType);

		if (!(originalCollection instanceof Array))
			throw new InvalidTypeException("originalCollection");

		this.collectionType = collectionType;
		this.originalCollection = originalCollection;

		this.contextResolveLocal = this.contextResolveLocal.bind(this);
		this.getProperties = this.getProperties.bind(this);
		this.getProperty = this.getProperty.bind(this);
		this.getPropertyCanonical = this.getPropertyCanonical.bind(this);

		entityStorageCollection.addStorage(this, collectionType.entityType.typeName);

		this.storageCollection = entityStorageCollection;
	}

	/**
	 *
	 * @type {PropertyTypeCollection}
	 */
	collectionType = null;

	originalCollection = [];

	Edits = [];

	/**
	 * @typedef {Array} ChangedPropertyCompound
	 * @property {boolean|null} 0 - True only if the items differs from the original entry, null if the item is scheduled for deletion
	 * @property {string} 1 - The value, undefined if namedLocation could not be resolved
	 */

	/**
	 * Returns undefined if namedLocation can not be localized, otherwise an array where the first (boolean) value defines if the entry was edited and
	 * the second value is the entry itself
	 * @param {string|string[]} namedLocation
	 * @param {boolean} [onlyOriginal=false]
	 * @param {boolean} [onlyEdits=false]
	 * @param {string} [mergingStrategy="DEEP_SIMPLE"] - Determines how the accessed value will be merged from original item and edits
	 * @returns {ChangedPropertyCompound|undefined}
	 */
	getProperty = function (
		namedLocation,
		onlyOriginal = false,
		onlyEdits = false,
		mergingStrategy = DELTA_MERGE_STRATEGIES.DEEP_SIMPLE
	) {
		let cEdit = this.contextResolveLocal(this.Edits, namedLocation);
		if (onlyEdits) {
			if (cEdit !== undefined)
				return [true, cEdit];
			else
				return undefined;
		}

		let cOrig = this.contextResolveLocal(this.originalCollection, namedLocation);
		if (onlyOriginal) {
			if (cOrig !== undefined)
				return [false, cOrig];
			else
				return undefined;
		}

		switch (mergingStrategy) {
			case DELTA_MERGE_STRATEGIES.DEEP_SIMPLE:
				if (cEdit !== undefined) {
					if (cOrig !== undefined) {
						if (cEdit._STATE === ENTITY_STATE_ENUMERATIONS.DELETED)
							return undefined;
						else {
							if (typeof cOrig === "object") // only merge compound objects
								return [true, mergeDeep(Object.assign({}, cOrig), cEdit)];
							else
								return [true, cEdit];
						}
					} else
						return [true, cEdit];
				} else if (cOrig !== undefined) {
					return [false, cOrig];
				} else {
					return undefined;
				}

				break;
		}
	}

	/**
	 * Same as getProperty, but always returning [Content, isChanged]
	 *
	 * @param namedLocation
	 * @param onlyOriginal
	 * @param onlyEdits
	 * @param mergingStrategy
	 * @returns {ChangedPropertyCompound}
	 */
	getPropertyCanonical (
		namedLocation,
		onlyOriginal = false,
		onlyEdits = false,
		mergingStrategy = DELTA_MERGE_STRATEGIES.DEEP_SIMPLE
	) {
		let Result = this.getProperty(namedLocation, onlyOriginal, onlyEdits, mergingStrategy);

		if (Result === null || Result === undefined)
			return [Result, false];
		else
			return Result;
	}

	/**
	 * Returns undefined if namedLocation can not be localized, otherwise an array of arrays where the first (boolean) value defines if the entry was edited and
	 * the second value is the entry itself
	 * @param {string|string[]} namedLocation
	 * @param {boolean} [onlyOriginal=false]
	 * @param {boolean} [onlyEdits=false]
	 * @param {boolean} [mergeResults=true] - If true, entries from Edits will be selected instead of the corresponding entries in Original (i.e. no deep merging)
	 * @returns {ChangedPropertyCompound[]|undefined}
	 */
	getProperties = function (
		namedLocation,
		onlyOriginal = false,
		onlyEdits = false,
		mergeResults = true
	) {
		let collectionEdits = this.contextResolveLocal(this.Edits, namedLocation),
			collectionOriginal = this.contextResolveLocal(this.originalCollection, namedLocation);

		if (!collectionOriginal || !(collectionOriginal instanceof Array))
			return undefined;

		// Only throw exception for edits if they are supplied but not an array
		if (collectionEdits && !(collectionEdits instanceof Array))
			throw new InvalidTypeException("collectionEdits");

		if (onlyEdits)
			return collectionEdits.map((someEntity) => [true, someEntity]);

		if (onlyOriginal || !collectionEdits)
			return collectionOriginal.map((someEntity) => [false, someEntity]);

		let Result = [];

		// Merge
		if (mergeResults) {
			let idProperty = this.collectionType.entityType.idProperty;

			/**
			 * Maps idProperty => index
			 * @type {{}}
			 */
			let idMapOriginal = {};
			for (let i = 0; i < collectionOriginal.length; i++)
				idMapOriginal[collectionOriginal[i][idProperty]] = i;

			for (let someEntity of collectionEdits) {
				if (idMapOriginal[someEntity[idProperty]] !== undefined)
					delete idMapOriginal[someEntity[idProperty]];

				Result.push([someEntity._STATE === ENTITY_STATE_ENUMERATIONS.DELETED ? null : true, someEntity]);
			}

			for (let idProperty in idMapOriginal) {
				let index = idMapOriginal[idProperty];
				Result.splice(index, 0, [false, collectionOriginal[index]]);
			}
		}

		return Result;
	}

	/**
	 *
	 * @param {boolean} returnEdits
	 * @returns EntityStorage|Array
	 */
	clearEdits = function (
		returnEdits = false
	) {
		this.lastEditedLocation = null;
		this.Edits = [];
		if (returnEdits)
			return this.Edits;
		else
			return this;
	}

	// Only fetch entries and sub-entries which have changed
	// These entries have a corresponding _ACTION tag o specify in what way they have been changed (updated/removed/added);
	// see ENTITY_STATE_ENUMERATIONS
	getEdits = function () {
		if (this.Immutability)
			return this.Edits;
		else
			return [...this.Edits];
	}

	/**
	 * Returns an array of namedLocation strings pointing at the currently changed items
	 * @return {string[]}
	 */
	getEditedNamedLocations = function () {
		return ["", ""];
	}

	/**
	 *
	 * @param {object[]} newEdits
	 * @returns {EntityStorage}
	 */
	setEdits = function (newEdits) {
		this.Edits = newEdits;
		return this;
	}

	/**
	 * Returns a list of entities with merged properties from original collections and edited values+
	 * @param {object} originalEntity
	 * @returns Array
	 */
	getMerged = function () {
		return this.originalCollection.map(this.getMergedEntity.bind(this));
	}

	/**
	 * Returns an entity with merged properties from the original collection and edited values
	 * @param {object} originalEntity
	 * @returns {object}
	 */
	getMergedEntity = function (originalEntity) {
		let rootPropertyType = this.collectionType.entityType;
		let rootIdValue = originalEntity[rootPropertyType.idProperty];

		let editedEntry = this.contextResolveLocal(this.Edits, `${rootPropertyType.idProperty}.${rootIdValue}`);
		if (!editedEntry)
			return originalEntity;

		let Result = Object.assign({}, originalEntity);

		/**
		 *
		 * @param {PropertyTypeObject} parentType
		 * @param {string} propertyName
		 * @param parentA
		 * @param parentB
		 */
		let onCollection = function (
			parentType, propertyName, parentA, parentB
		) {

		}

		/**
		 *
		 * @param {PropertyTypeObject|PropertyTypeCollection} parentType
		 * @param {string} propertyName
		 * @param parentA
		 * @param parentB
		 */
		let onObject = function (
			parentType, propertyName, parentA, parentB
		) {

		}

		/**
		 *
		 * @param {PropertyTypeObject} parentType
		 * @param {string} propertyName
		 * @param parentA
		 * @param parentB
		 */
		let onFinal = function (parentType, propertyName, parentA, parentB) {

		}


		/**
		 *
		 * @param {PropertyType} parentType
		 * @param parentA
		 * @param parentB
		 * @param {string|number} nameOrIndex
		 */
		let iterate = function (parentType, parentA, parentB, nameOrIndex) {
			if (parentType instanceof PropertyTypeCollection ||
				parentType instanceof PropertyTypeCollection.prototype) {
				let newPropertyType = propertyType.entityType;

				let skipLoop = false;
				if (nameOrIndex !== undefineda && onCollection(propertyType, contextA, contextB) === false)
					skipLoop = true;

				if (!skipLoop)
					for (let i = 0; i < contextA.length; i++) {
						let newContextA = contextA[i];
						let idValue = newContextA[newPropertyType.idProperty];

						let newContextB = this.contextResolveLocal(contextB, `${newPropertyType.idProperty}.${idValue}`, {returnIndex: true});
						if (newContextB === undefined)
							continue;
						else {
							iterate(newContextA, newContextB, newPropertyType, i);
						}
					}

			} else if (
				parentType instanceof PropertyTypeObject ||
				parentType instanceof PropertyTypeObject.prototype
			) {
				let currentType = parentType.definedProperties[nameOrIndex];

				if (currentType instanceof PropertyTypeObject ||
					currentType instanceof PropertyTypeObject.prototype) {

					let currentA = parentA[nameOrIndex],
						currentB = parentB[nameOrIndex];

					let currentIdProperty = currentType.idProperty;
					if (!currentA.hasOwnProperty(currentIdProperty))
						throw new Error(`idProperty <${currentIdProperty}> not registered`);

					if (currentB &&
						typeof currentB[currentIdProperty] === typeof currentA[currentIdProperty] &&
						currentB[currentIdProperty] !== currentA[currentIdProperty]) {
						parentA[nameOrIndex] = currentB;
					}

				} else if (
					currentType instanceof PropertyTypeCollection ||
					currentType instanceof PropertyTypeCollection.prototype
				) {

				} else if (typeof currentType === "string") {
					return onFinal(parentType, nameOrIndex, parentA, parentB)
				} else
					throw new Error(`Invalid type <${currentType}>`);
			}
		}
		console.log(rootPropertyType.definedPropertiesWithoutId());
		for (let propertyName of rootPropertyType.definedPropertiesWithoutId()) {
			iterate(rootPropertyType, Result, editedEntry, propertyName);
		}

		return Result;
	}

	/**
	 *
	 * @param {object[]} someCollection
	 * @returns {EntityStorage.setCollection}
	 */
	setCollection = function (someCollection) {
		this.originalCollection = someCollection;
		return this;
	}

	/**
	 * Get the ID properties of base entities associated to this editor
	 * @param {boolean} includeTemplates - If true, will also include entries of added templates
	 * @returns Array
	 */
	getChildIds = function (
		includeTemplates = true
	) {
		let This = this;

		let childIds = this.originalCollection.map((cEntry) => cEntry[this.collectionType.entityType.idProperty]);
		if (includeTemplates) {
			for (let cEntry of This.Edits) {
				if (cEntry[IS_TEMPLATE_PROPERTY_NAME] === true) {
					childIds.unshift(cEntry[This.collectionType.entityType.idProperty])
				}
			}
		}

		return childIds;
	}

	/**
	 * Used in the evaluation of namedLocations to denote a specific array index
	 * @type {string}
	 */
	static arrayIndexIdentifier = "~index~";

	/**
	 * Iterates through an array of ChangedPropertyCompound items and checks if one value was changed (i.e. updated/deleted)
	 * @param {ChangedPropertyCompound[]} compoundArray
	 * @returns {boolean}
	 */
	static onePropertyChanged (compoundArray) {
		for (let compound of compoundArray) {
			if (compound && compound[0] !== false)
				return true;
		}

		return false;
	}

	/**
	 *
	 * @return {boolean}
	 */
	onePropertyChanged (){
		return this.Edits.length > 0;
	}

	/**
	 * Creates a lock bound to the property pointed to by namedLocation. Persists until unlockAt is called.
	 * When the entityStorage is locked, any edits to namedLocation
	 *
	 * @param {string} namedLocation
	 */
	lockAt (namedLocation) {
		if (this.lockingProperty)
			throw new Error(`EntityStorage already locked at <${this.lockingProperty}>`);

		this.lockingProperty = namedLocation;
	}

	/**
	 * Removes a lock created by lockAt
	 *
	 * @param {string} namedLocation
	 */
	unlockAt (namedLocation) {
		if (!namedLocation || this.lockingProperty !== namedLocation)
			throw new Error(`Unlock at incorrect location`);

		this.lockingProperty = null;
	}

	/**
	 * A pointer the location locking any further edits
	 *
	 * @type {string|null}
	 */
	lockingProperty = null;

	/**
	 *
	 * @param {object} entityA
	 * @param {object} entityB
	 * @param {PropertyType|string} [propertyType] - May be supplied a PropertyType item for better comparison
	 * @param {string} [comparisonStrategy]
	 */
	static entityEquals (
		entityA,
		entityB,
		propertyType = null,
		comparisonStrategy = ENTITY_COMPARISON_STRATEGIES.DEEP_SIMPLE
	) {
		if (propertyType) {
			if (propertyType instanceof PropertyTypeObject ||
				propertyType.prototype instanceof PropertyTypeObject)
				return entityA[propertyType.idProperty] === entityB[propertyType.idProperty];
			else if (
				propertyType instanceof PropertyTypeCollection ||
				propertyType.prototype instanceof PropertyTypeCollection
			) {
				throw new NotImplementedException(`entityEquals(Collection)`);
			} else
				console.warn(`Undefined usage of entityEquals()`);
		}

		switch (comparisonStrategy) {
			case ENTITY_COMPARISON_STRATEGIES.DEEP_SIMPLE:
				let f = function (a, b) {
					if (a) {
						if (typeof a !== typeof b)
							return false;

						if (typeof a === "string" || typeof a === "number") {
							return a === b;
						} else if (a instanceof Date) {
							return (b && b instanceof Date && a.getTime() === b.getTime());
						} else if (a instanceof Array) {
							return (b instanceof Array && a.length === b.length && a.every((value, index, array) => {
								return f(a[index], b[index]);
							}));
						} else // TODO: Other object comparisons
						{ // Some object
							for (let propertyName in a) {
								if (typeof b[propertyName] !== typeof b[propertyName] ||
									!f(a[propertyName], b[propertyName]))
									return false;
							}

							return true;
						}
					} else
						return a === b;
				}

				if(f(entityA, entityB))
					return true;

				break;

			default: throw new NotImplementedException(`Unknown comparison strategy <${comparisonStrategy}>`);
		}

		return false;
	}

	/**
	 *
	 * @param {object[]} rootContext
	 * @param {string|string[]} namedLocationBase
	 * @param {string|function} sortPropertyOrFunction - If a function is supplied, it may sort entries according to Array.sort()
	 * @param {string} [sortDirection="ASC"]
	 * @returns {object[]|undefined}
	 */
	static sortContextBy (
		rootContext,
		namedLocationBase,
		sortPropertyOrFunction,
		sortDirection = "ASC"
	) {
		let baseContext = this.contextResolveLocal(rootContext, namedLocationBase);
		if (typeof baseContext === "undefined")
			return baseContext;

		if (!(baseContext instanceof Array))
			throw new InvalidTypeException("baseContext");

		if (typeof sortPropertyOrFunction === "function")
			return baseContext.sort(sortPropertyOrFunction);
		else if (typeof sortPropertyOrFunction === "string") {
			return baseContext.sort((a, b) =>
				(a === b) ? 0 : (
					(sortDirection === "ASC") ?
						(( (""+a[sortPropertyOrFunction]) > (""+b[sortPropertyOrFunction]) ) ? +1 : -1 ) :
						(( (""+a[sortPropertyOrFunction]) < (""+b[sortPropertyOrFunction]) ) ? +1 : -1 )
				)
			);
		} else
			throw new InvalidTypeException("sortPropertyOrFunction");
	}

	/**
	 *
	 * @param rootContext
	 * @param namedLocation
	 * @param returnIndex
	 * @param returnType
	 * @param verbose
	 * @returns *|[PropertyTypeObject|PropertyTypeCollection, Object[]]|Object[]
	 */
	contextResolveLocal (
		rootContext,
		namedLocation,
		{
			returnIndex = false,
			returnType = false,
			returnContent = true,
			rootPropertyType = this.collectionType,
			verbose = true
		} = {}
	) {
		if (returnContent || returnIndex)
			return EntityStorage.contextResolve(rootContext, namedLocation, returnIndex, rootPropertyType, verbose, returnType);
		else if (returnType)
			return EntityStorage.contextResolveTypeOnly(namedLocation, {
				rootPropertyType,
				verbose
			});
	}

	/**
	 * Run-time optimized version of contextResolve when only type information is desired
	 *
	 * @param {string|string[]} namedLocation
	 * @param {boolean} [verbose]
	 * @param {PropertyType} [rootPropertyType] - Defaults to the collectionType handled by this entityStorage
	 * @returns {PropertyType|string}
	 */
	static contextResolveTypeOnly (
		namedLocation,
		{
			verbose = true,
			rootPropertyType = null
		} = {}
	) {
		let cType = rootPropertyType;

		let updateType = (propertyName) => {
			if (cType && cType.prototype) {
				if (cType.prototype instanceof PropertyTypeCollection)
					cType = cType.entityType;
				else if (cType.prototype instanceof PropertyTypeObject)
					cType = cType.Properties[propertyName];
				else if (verbose)
					console.warn(`Could not resolve property <${propertyName}> at type <${cType.typeName}>`)
			}
		}

		let namedLocationArray = (typeof namedLocation === "string") ? namedLocation.split('.') : namedLocation;
		while (namedLocationArray.length) {
			/**
			 * @type {string}
			 */
			let currentLocation = namedLocationArray.shift();

			let propertyName =
				(currentLocation.lastIndexOf("#") !== -1) ? currentLocation.substr(currentLocation.lastIndexOf("#")) : currentLocation;

			updateType(propertyName);
		}

		return cType;
	}

	/**
	 * Locates a property the following way:
	 * - "." to point to properties of objects
	 * - "#"
	 * 	--> if only 1 #: "propertyName#propertyValue" to point to a member of an array where propertyName = propertyValue
	 * 		if propertyName === ""
	 *  --> for two #: third entry (after 2. #) will be used as propertyName; for compatability with Edit
	 * @param {object[]} rootContext
	 * @param {string|string[]} namedLocation
	 * @param {boolean} [returnIndex=false] - If an array is the last selected context, contextResolve will return the index of the found entity instead of its value
	 * @param {PropertyTypeObject|PropertyTypeCollection} [rootPropertyType=null]
	 * @param {boolean} [verbose=false]
	 * @param {boolean} [returnType=false] - If true, returns an array of structure [Type, Content], or null otherwise
	 */
	static contextResolve (
		rootContext,
		namedLocation,
		returnIndex = false,
		rootPropertyType = null,
		verbose = true,
		returnType = false
	) {
		let arrNamedLocation = namedLocation;
		if (typeof namedLocation === "string")
			arrNamedLocation = namedLocation.split(".");

		let cType = rootPropertyType;
		let updateType = (propertyName) => {
			if (cType && cType.prototype) {
				if (cType.prototype instanceof PropertyTypeCollection)
					cType = cType.entityType;
				else if (cType.prototype instanceof PropertyTypeObject)
					cType = cType.Properties[propertyName];
				else if (verbose)
					console.warn(`Could not resolve property <${propertyName}> at type <${cType.typeName}>`)
			}
		}

		/**
		 *
		 * @param {object} curContext
		 * @param {string} curName
		 */
		let resolve = function (curContext, curName) {
			if (curName.includes("#")) {
				let propertyCombo = curName.split("#");
				let propertyName,
					propertyValue;

				if (propertyCombo.length === 2) {
					propertyName = propertyCombo[0];
					propertyValue = propertyCombo[1];

					// Iterate until a match was found
					if (!curContext || !(curContext instanceof Array)) {
						if (verbose && ConfigCurrent.devMode) {
							console.error(`curContext was expected to be a collection; received something else at propertyName <${propertyName}> and propertyValue <${propertyValue}>. curContext:`);
							console.error(curContext);
						}

						//throw new InvalidTypeException("curContext");
						return undefined;
					}

					if (propertyName === EntityStorage.arrayIndexIdentifier) {
						let arrayIndex = parseInt(propertyValue);
						if (arrayIndex != propertyValue) {
							if (ConfigCurrent.devMode)
								console.error(`Received an invalid array index - Could not parse as integer`);

							throw new InvalidStateException("arrayIndex");
						}

						if (typeof curContext[arrayIndex] === "undefined") {
							if (ConfigCurrent.devMode)
								console.error(`Collection member at position <${arrayIndex}> undefined`);

							throw new InvalidStateException("curContext[arrayIndex]");
						}

						if (returnIndex)
							return arrayIndex;
						else
							return curContext[arrayIndex];
					} else {
						updateType(propertyName);

						if (cType && cType === "number") {
							propertyValue = +propertyValue;
						}

						for (let cIndex = 0; cIndex < curContext.length; cIndex++) {
							let cObject = curContext[cIndex];
							if (cObject[propertyName] === propertyValue) {
								if (returnIndex)
									return cIndex;
								else
									return cObject;
							}
						}
					}
				} else if (propertyCombo.length === 3) {
					propertyName = propertyCombo[2];
					updateType(propertyName);
					if (typeof curContext[propertyName] !== "undefined")
						return curContext[propertyName];
				}

				return undefined;
			} else {
				if (typeof curContext[curName] !== "undefined")
					return curContext[curName];

				return undefined;
			}
		}

		let cContext = rootContext;
		try {
			for (let curName of arrNamedLocation) {
				let cRes = resolve(cContext, curName);
				if (cRes === undefined)
					return cRes;

				cContext = cRes;
			}
		} catch (errorInfo) {
			console.log(errorInfo);
			return undefined;
		}

		if (returnType) {
			if (!cContext)
				return null;
			else
				return [cType, cContext];
		} else
			return cContext;
	}

	/**
	 *
	 * @param {number} idValue
	 * @param {object} [mergeObject={}] - If supplied, properties of this object will be merged into the resulting object at the correct position
	 * @returns {EntityStorage}
	 */
	addTemplate (
		idValue,
		mergeObject = {}
	) {
		let a = this.collectionType.entityType.createTemplate(idValue);
		a[IS_TEMPLATE_PROPERTY_NAME] = true;

		a = mergeDeep(a, mergeObject);

		this.Edits.push(a);

		return this;
	}

	/**
	 * TODO: Merge this with Edit()
	 * Inserts a model instance to the collection pointed to by namedLocation
	 * Caution: It is assumed that the parent node of the item to be inserted already exists. If this isn't the case, an exception will be thrown
	 * TBD: Rework this.
	 * @param {string|string[]} namedLocation - Must point to a defined PropertyTypeCollection within the type tree
	 * @param {PropertyTypeObject} modelInstance - Must be an instance of PropertyTypeCollection.entityType
	 * @return {EntityStorage}
	 */
	Insert (
		namedLocation,
		modelInstance
	) {
		return this.Edit(namedLocation, modelInstance, STORE_ACTION_TYPE_ENUMERATION.INSERT);
	}

	/**
	 * Rejects the changes for the property/properties at namedLocation by deleting the corresponding values in the Edits section
	 * @param {string} namedLocation
	 */
	Reject (
		namedLocation
	) {
		return this.Edit(namedLocation, undefined, STORE_ACTION_TYPE_ENUMERATION.REJECT);
	}

	/**
	 * For details about namedLocation, see contextResolve
	 * In addition to that, it's strongly recommended to supply the idProperty for every object and subj object referenced
	 * WHAT'S SPECIAL: For this, a third part in an identifying part "idColumn#idProperty#propertyName" will be interpreted as the name of the property to create an
	 * entry for the currently scoped item (which has to be registered at PropertyType)
	 *
	 * @param {string|string[]} namedLocation
	 * @param {any} Value - If undefined, the property pointed at by namedLocation will be deleted according to the behavior defined by actionType
	 * @param {string} [actionType] - Used to force a specific behavior. See STORE_ACTION_TYPE_ENUMERATION
	 * @param {boolean} [verbose=false]
	 * @returns {EntityStorage}
	 * @throws {InvalidTypeException}
	 */
	Edit (
		namedLocation,
		Value,
		actionType = STORE_ACTION_TYPE_ENUMERATION.UPDATE,
		verbose = true
	) {
		if (typeof namedLocation === "string")
			namedLocation = namedLocation.split(".");

		// Obey allowParallelEdits
		let joinedNamedLocation = namedLocation.join(".");
		if (!this.allowParallelEdits && typeof this.lastEditedLocation === "string" && this.lastEditedLocation !== joinedNamedLocation)
			throw new IllegalParallelEditException(namedLocation);

		this.lastEditedLocation = joinedNamedLocation;

		// Check the edits item from the root of namedLocation until the end
		let cLocationPropertyType = this.collectionType,
			cLocationUntil = [];

		if (verbose)
			console.log(`Starting with propertyType`, cLocationPropertyType);

		let lastEditContext = this.Edits,
			lastOrigContext = this.originalCollection;

		let runsToSkip = 0;
		for (let cLocationIndex = 0; cLocationIndex < namedLocation.length; cLocationIndex++) {
			let endReached = (cLocationIndex + 1) === namedLocation.length;

			let cLocationName = namedLocation[cLocationIndex];
				cLocationUntil.push(cLocationName);
				if (verbose)
					console.log(`cLocationName <${cLocationName}>`);

			if (runsToSkip) {
				runsToSkip--;
				continue;
			}

			let cEditContext = this.contextResolveLocal(lastEditContext, cLocationName);
			let	cOrigContext;
			if (lastOrigContext) // Support for editing items that are only stored in the Edits object
				cOrigContext = this.contextResolveLocal(lastOrigContext, cLocationName);

			if (cLocationPropertyType instanceof PropertyTypeCollection ||
				cLocationPropertyType.prototype instanceof PropertyTypeCollection) {
				let cCollection = cLocationPropertyType;
				cLocationPropertyType = cLocationPropertyType.entityType;

				if (verbose)
					console.log(`Updating cLocationPropertyType:Collection to`, cLocationPropertyType);

				// If there are no saved edits for this location, create a new empty object with just the corrsponding idProperty
				if (cEditContext === undefined) {
					/*if (cOrigContext === undefined && ConfigCurrent.devMode) {
						console.error(`Unknown namedLocation at orig-arr <${namedLocation.join(".")}>. Failed resolving <${cLocationName}> at lastOrigContext: `);
						console.error(lastOrigContext);
					}*/

					// Assume an ID value was supplied
					let idPropertyName = cLocationPropertyType.idProperty;
					let idPropertyValue = cLocationName.split("#")[1];

					if (verbose)
						console.log(`Parsing ID`, cLocationPropertyType, idPropertyName, idPropertyValue);
					idPropertyValue = EntityStorage.parseProperty(cLocationPropertyType, idPropertyName, idPropertyValue);
					if (verbose)
						console.log(`Parsed value`, idPropertyValue);

					if (!cLocationName.startsWith(`${idPropertyName}#`) && ConfigCurrent.devMode)
						console.error(`Unknown idProperty at orig-arr <${namedLocation.join(".")}>`);

					let emptyEntry = {};
					emptyEntry._STATE =
						(actionType === STORE_ACTION_TYPE_ENUMERATION.DELETE) ? (endReached ? ENTITY_STATE_ENUMERATIONS.DELETED : ENTITY_STATE_ENUMERATIONS.UPDATED) :
						(cOrigContext === undefined) ? ENTITY_STATE_ENUMERATIONS.INSERTED : ENTITY_STATE_ENUMERATIONS.UPDATED;
					emptyEntry[idPropertyName] = idPropertyValue;

					lastEditContext.push(emptyEntry);
					cEditContext = emptyEntry;
				} else if (endReached) {
					// The entry was edited and the end of the chain was reached

					let entryIndex = EntityStorage.contextResolve(lastEditContext, cLocationName, true, cLocationPropertyType);
					if (typeof entryIndex !== "number") {
						if (verbose)
							console.log(`Failed finding a valid entryIndex. lastEditContext and cLocationName: `, lastEditContext, cLocationName);

						throw new InvalidStateException(`Item not found <${cLocationName}>`);
					}

					// Reject if deleting an inserted item/template
					if (actionType === STORE_ACTION_TYPE_ENUMERATION.DELETE &&
						lastEditContext[entryIndex]._STATE === ENTITY_STATE_ENUMERATIONS.INSERTED)
						actionType = STORE_ACTION_TYPE_ENUMERATION.REJECT;

					switch (actionType) {
						case STORE_ACTION_TYPE_ENUMERATION.REJECT:
							// Delete the whole entry
							lastEditContext.splice(entryIndex, 1);

							if (!lastEditContext.length) {
								namedLocation.pop();

								if (verbose)
									console.log(`Bubbling up <${namedLocation}>, seeking orphaned parent items`);

								return this.Edit(namedLocation, undefined, STORE_ACTION_TYPE_ENUMERATION.REJECT, verbose);
							}
							this.lastEditedLocation = null;
							break;

						case STORE_ACTION_TYPE_ENUMERATION.DELETE:
							lastEditContext[entryIndex]._STATE = ENTITY_STATE_ENUMERATIONS.DELETED;
							break;

						case STORE_ACTION_TYPE_ENUMERATION.INSERT:
							// TODO: Calculate total number before!
							if (cCollection.getMaximumMembers() === lastEditContext.length)
								throw new InvalidStateException(`lastEditContext.length`);

							if (Value) {
								if (!(Value instanceof cLocationPropertyType) && ConfigCurrent.devMode)
									console.warn(`Supplied entity is not of type <${cLocationPropertyType.typeName}>. Auto-creating... given value: `, Value);

								Value = new cLocationPropertyType();
							}

							Value._STATE = ENTITY_STATE_ENUMERATIONS.INSERTED;

							if (cLocationPropertyType.hasOwnProperty("idProperty") && !Value[cLocationPropertyType.idProperty]) {
								if (verbose)
									console.log(`Pending insertion entity instance of <${cLocationPropertyType.typeName}> without idProperty. Attempting to generate UUID`);

								let defaultIdProperty = cLocationPropertyType.defaultValues[cLocationPropertyType.idProperty];
								if (defaultIdProperty && defaultIdProperty instanceof IDGenerator) {
									Value[cLocationPropertyType.idProperty] = defaultIdProperty.Generate();
								} else if (verbose) {
									console.warn(`Anti-pattern action detected: Could not auto-generate ID`);
								}
							}
							lastEditContext.push(Value);
							break;
					}
				} else {
					// The entry was edited
					// Find the referenced entry through the # separated values

					cEditContext = this.contextResolveLocal(lastEditContext, cLocationName);
					if (verbose)
						console.log(`Switching cEditContext using <${cLocationName}> to`, cEditContext);
				}
			} else if (
				cLocationPropertyType instanceof PropertyTypeObject ||
				cLocationPropertyType.prototype instanceof PropertyTypeObject
			) {

				if (cEditContext === undefined) {
					// The entry was not yet edited before
					// Create a template, or edit the entry at the end of the chain

					/*if (cOrigContext === undefined && ConfigCurrent.devMode) {
						console.error(`Unknown namedLocation at orig-obj <${namedLocation.join(".")}>. Failed resolving <${cLocationName}> at lastOrigContext: `);
						console.error(lastOrigContext);
					}*/

					if (endReached) {
						// The end of the chain was reached. Execute the desired action

						switch (actionType) {
							case STORE_ACTION_TYPE_ENUMERATION.UPDATE:
								if (cLocationPropertyType.Properties[cLocationName]) {
									if (cLocationPropertyType.Properties[cLocationName].prototype instanceof PropertyTypeCollection) {
										throw new NotImplementedException("PropertyTypeCollection at UPDATE");
									} else if (cLocationPropertyType.Properties[cLocationName].prototype instanceof PropertyTypeObject) {
										// TODO: Check if UPDATED state was successfully applied to parent entity
										lastEditContext[cLocationName] = Value;
										//throw new NotImplementedException("PropertyTypeObject at UPDATE");
									} else if (typeof cLocationPropertyType.Properties[cLocationName] === "string") {
										lastEditContext[cLocationName] = Value;
									}
								} else if (verbose)
									console.warn(`Unregistered property <${cLocationName}> at <${cLocationPropertyType.typeName}>`);

								break;

							case STORE_ACTION_TYPE_ENUMERATION.INSERT:
								if (
									cLocationPropertyType.Properties[cLocationName] &&
									cLocationPropertyType.Properties[cLocationName].prototype instanceof PropertyTypeCollection
								) {
									Value._STATE = ENTITY_STATE_ENUMERATIONS.INSERTED;
									lastEditContext[cLocationName] = [Value];
								} else if (
									cLocationPropertyType.Properties[cLocationName] &&
									cLocationPropertyType.Properties[cLocationName].prototype instanceof PropertyTypeObject
								) {
									Value._STATE = ENTITY_STATE_ENUMERATIONS.INSERTED;
									lastEditContext[cLocationName] = Value;
								} else
									throw new InvalidStateException(`Stumbled upon unhandled property <${cLocationName}> at object <${cLocationPropertyType.typeName}> `);
								break;

							case STORE_ACTION_TYPE_ENUMERATION.DELETE:
								if (
									cLocationPropertyType.Properties[cLocationName] &&
									cLocationPropertyType.Properties[cLocationName].prototype instanceof PropertyTypeCollection
								) {
									console.log("asdfasdfasdf", cLocationPropertyType, actionType);
									throw new NotImplementedException("TODO: cEditContext===undefined&&endOfChain&&cLocationPropertyType.Properties[cLocationName] instanceof PropertyTypeCollection");
								} else if (
									cLocationPropertyType.Properties[cLocationName] &&
									cLocationPropertyType.Properties[cLocationName].prototype instanceof PropertyTypeObject
								) {
									console.log(`Deleting item`, cLocationPropertyType, lastEditContext);

									if (!lastEditContext[cLocationName])
										lastEditContext[cLocationName] = {}

									let { idProperty } = cLocationPropertyType.Properties[cLocationName];

									lastEditContext[cLocationName][idProperty] = lastOrigContext[cLocationName][idProperty];

									lastEditContext[cLocationName]._STATE = ENTITY_STATE_ENUMERATIONS.DELETED;
								} else {
									console.log("asdfasdfasdf", cLocationPropertyType, actionType);
									throw new NotImplementedException("TODO: cEditContext===undefined&&endOfChain&&unknown cLocationPropertyType.Properties[cLocationName]");
								}
								break;

							default:
								console.log("asdfasdfasdf", cLocationPropertyType, actionType);
								throw new NotImplementedException("TODO: cEditContext===undefined&&endOfChain");
						}

					} else {
						// The end of the chain was not yet reached

						// The property name for object types will be extracted here
						if (cLocationName.includes("#")) {
							let idPropertyTemp = cLocationName.split("#"),
								cPropertyName,
								idPropertyName,
								idPropertyValue;

							if (idPropertyTemp.length === 3) {
								cPropertyName = idPropertyTemp[2];
								idPropertyName = cLocationPropertyType.idProperty;
								idPropertyValue = idPropertyTemp[1];
							} else if (idPropertyTemp.length === 2 && false) {
								if (verbose)
									console.log("SKIPPING", cLocationName);

								// Use the property after the next "." as name of the collection; e.g. id#3.cars.id#2.wheels; the next run will be skipped in this case
								runsToSkip++;

								cPropertyName = namedLocation[cLocationIndex + 1]; // use the item after the next dot
								idPropertyName = cLocationPropertyType.idProperty;
								idPropertyValue = idPropertyTemp[1];

								if (verbose)
									console.log(cPropertyName);
							}

							if (!cLocationPropertyType.Properties[cPropertyName] && ConfigCurrent.devMode) {
								console.error(`Unregistered PropertyType child of type-obj <${cPropertyName}> as in location part <${cLocationName}>. cLocationPropertyType: `, cLocationPropertyType);
								console.error(`lastEditContext: `, lastEditContext);
							}

							cLocationPropertyType = cLocationPropertyType.Properties[cPropertyName];
							if (verbose)
								console.log(`Updating cLocationPropertyType:Object to`, cLocationPropertyType);

							// Assume an ID value was supplied
							if (!cLocationName.startsWith(`${idPropertyName}#`) && ConfigCurrent.devMode)
								console.error(`Unknown idProperty at orig-obj <${namedLocation.join(".")}>`);

							// Assume an ID value was supplied
							if (verbose)
								console.log(`Parsing ID`, cLocationPropertyType, idPropertyName, idPropertyValue);
							idPropertyValue = EntityStorage.parseProperty(cLocationPropertyType, idPropertyName, idPropertyValue);
							if (verbose)
								console.log(`Parsed value`, idPropertyValue);

							let emptyEntry = {};
							emptyEntry._STATE = (cOrigContext === undefined) ? ENTITY_STATE_ENUMERATIONS.INSERTED : ENTITY_STATE_ENUMERATIONS.UPDATED;
							emptyEntry[idPropertyName] = idPropertyValue;

							lastEditContext[cPropertyName] = emptyEntry;
							cEditContext = emptyEntry;
						} else {
							if (!cLocationPropertyType.Properties[cLocationName] && ConfigCurrent.devMode) {
								console.error(`Unregistered PropertyType child of type-obj <${cLocationName}>. cLocationPropertyType: `, cLocationPropertyType);
								console.error(`lastEditContext: `, lastEditContext);
							}

							cLocationPropertyType = cLocationPropertyType.Properties[cLocationName];

							if (cLocationPropertyType instanceof PropertyTypeCollection ||
								cLocationPropertyType.prototype instanceof PropertyTypeCollection)
							{
								if (verbose)
									console.log(`Inserting empty edits-collection <${cLocationPropertyType.typeName}> of <${cLocationPropertyType.entityType.typeName}> at <${cLocationName}>`);

								lastEditContext[cLocationName] = [];
								cEditContext = lastEditContext[cLocationName];
							} else if (
								cLocationPropertyType instanceof PropertyTypeObject ||
								cLocationPropertyType.prototype instanceof PropertyTypeObject)
							{
								if (verbose)
									console.log(`Inserting empty edits-object of <${cLocationPropertyType.typeName}> at <${cLocationName}>`);

								let emptyObject = {};

								if (cLocationPropertyType.idProperty !== "")
									emptyObject[cLocationPropertyType.idProperty] = cOrigContext[cLocationName];

								lastEditContext[cLocationName] = emptyObject;
								cEditContext = lastEditContext[cLocationName];
							}

							if (verbose)
								console.log(`Updating cLocationPropertyType:Object to`, cLocationPropertyType);
						}
					}
				} else if (endReached) {
					// The entry was edited and the end of namedLocation was reached

					// TODO: What about "Value === cOrigContext"?
					// UPDATE 01.01.2021: Handling of string/number types; remaining: handling of compound objects

					// Reject if deleting an inserted item/template
					if (actionType === STORE_ACTION_TYPE_ENUMERATION.DELETE &&
						lastEditContext[cLocationName]._STATE === ENTITY_STATE_ENUMERATIONS.INSERTED)
						actionType = STORE_ACTION_TYPE_ENUMERATION.REJECT;

					switch (actionType) {
						case STORE_ACTION_TYPE_ENUMERATION.REJECT:
							delete lastEditContext[cLocationName];

							// When only idProperty exists, delete the current item

							// Deleting this will also "bubble up" the chain, i.e. all parents that are also empty will get deleted as well
							this.bubbleUpDeletion(namedLocation, lastEditContext, cLocationPropertyType);

							this.lastEditedLocation = null;
							break;

						case STORE_ACTION_TYPE_ENUMERATION.UPDATE:
							// TODO: Parse the value as defined with PropertyType?
							lastEditContext[cLocationName] = Value;

							// NEW AS OF 01.01.2021: Enhanced diffing (reject change if entry is same as original value)
							// i.e. only _STATE, idProperty and cLocationName are present
							// _STATE was already checked (switch statement, so checking idProperty and cLocationName is sufficient)

							/**
							 * typeof lastEditContext[cLocationPropertyType.idProperty] !== "undefined" &&
								typeof lastEditContext[cLocationName] !== "undefined" &&
								Object.keys(lastEditContext).length === 3
							 */

							if (lastOrigContext) {
								if(typeof cLocationPropertyType.Properties[cLocationName] === "string") {
									if (lastOrigContext[cLocationName] === Value) {
										delete lastEditContext[cLocationName];
										this.bubbleUpDeletion(namedLocation, lastEditContext, cLocationPropertyType);
									}
								} else if (cLocationPropertyType.Properties[cLocationName].prototype instanceof PropertyTypeObject) {
									var propertyType = cLocationPropertyType.Properties[cLocationName];
									var idProperty = propertyType.idProperty;

									if (lastOrigContext[cLocationName][idProperty] === lastEditContext[cLocationName][idProperty]) {
										delete lastEditContext[cLocationName];
										this.bubbleUpDeletion(namedLocation, lastEditContext, cLocationPropertyType);
									}
								} else {
									console.error(`TODO: Implement bubbling up from rejection events of (compound) collections`);
								}
							}

							break;

						case STORE_ACTION_TYPE_ENUMERATION.DELETE:
							if (!cLocationPropertyType.Properties[cLocationName] && ConfigCurrent.devMode) {
								console.error(`Unregistered PropertyType child of type-obj <${cLocationName}>. cLocationPropertyType: `, cLocationPropertyType);
								console.error(`lastEditContext: `, lastEditContext);
							}

							console.log(`Deleting item`, cLocationPropertyType, lastEditContext);

							lastEditContext[cLocationName]._STATE = ENTITY_STATE_ENUMERATIONS.DELETED;

							break;

						case STORE_ACTION_TYPE_ENUMERATION.INSERT:
							if (
								cLocationPropertyType.Properties[cLocationName] &&
								cLocationPropertyType.Properties[cLocationName].prototype instanceof PropertyTypeCollection
							) {
								Value._STATE = ENTITY_STATE_ENUMERATIONS.INSERTED;
								lastEditContext[cLocationName].push(Value);
							}

							//throw new NotImplementedException(`Insert at object with existing edits at the end of a chain`);
							break;
					}
				} else {
					// The entry was edited but the end of namedLocation was not yet reached
					if (!cLocationName.includes("#")) {
						if (!cLocationPropertyType.Properties[cLocationName]) {
							if (ConfigCurrent.devMode) {
								console.error(`Unregistered PropertyType child of type-obj <${cLocationName}>. cLocationPropertyType: `, cLocationPropertyType);
								console.error(`lastEditContext: `, lastEditContext);
							}

							throw new InvalidStateException(`Properties<${cLocationName}> not registered in <${cLocationPropertyType.typeName}>`);
						}

						cLocationPropertyType = cLocationPropertyType.Properties[cLocationName];
						cEditContext = lastEditContext[cLocationName];
					} else {
						console.error(`Implement hanlding #-locations as in <${cLocationName}>`);
						throw new NotImplementedException("TODO");
					}
				}
			} else if (typeof cLocationPropertyType === "string") {
				if (ConfigCurrent.devMode)
					console.error(`Critical error: Intermediate location found that does not belong to an object/array <${cLocationName}> as part of ${namedLocation.join(".")}`);

				throw new InvalidStateException(`cLocationPropertyType`);
			} else
				throw new InvalidTypeException("cLocationPropertyType");

			lastEditContext = cEditContext;
			lastOrigContext = cOrigContext;
		}

		//console.log(this.Edits);

		return this;
	}

	/**
	 * Delets all local edits under a namedLocation
	 * Shortcut to Edit(..., undefined)
	 * @param {string} namedLocation
	 * @returns {EntityStorage}
	 */
	Delete (namedLocation) {
		return this.Edit(namedLocation, undefined, STORE_ACTION_TYPE_ENUMERATION.DELETE);
	}

	/**
	 * Parses a value according to the PropertyType information associated to this PropertyEditor
	 * @param {string|string[]} propertyPath
	 * @param {*} propertyValue
	 */
	parseRegisteredProperty (
		propertyPath,
		propertyValue
	) {
		return EntityStorage.parseProperty(this.collectionType.entityType, propertyPath, propertyValue);
	}

	/**
	 * Parses a value according to the given PropertyType information
	 * @param {PropertyTypeObject} basePropertyType
	 * @param {string|string[]} propertyPath
	 * @param {*} propertyValue
	 */
	static parseProperty (
		basePropertyType,
		propertyPath,
		propertyValue
	) {
		if (!(propertyPath instanceof Array))
			propertyPath = [propertyPath];

		/**
		 * Divide in firstPath and firstPathName to only select property names
		 * @type {string}
		 */
		let firstPathElement = propertyPath.shift(),
			propertyName = firstPathElement.split("#")[0];

		let selectedPropertyType;
		if (
			basePropertyType instanceof PropertyTypeObject ||
			basePropertyType.prototype instanceof PropertyTypeObject
		)
			selectedPropertyType = basePropertyType.Properties[propertyName];
		else if (
			basePropertyType instanceof PropertyTypeCollection ||
			basePropertyType.prototype instanceof PropertyTypeCollection
		)
			selectedPropertyType = basePropertyType.collectionType.entityType.Properties[propertyName];

		if (!selectedPropertyType && ConfigCurrent.devMode)
			console.error(`Property <${propertyName}> not registered at basePropertyType <${basePropertyType.typeName}>. namedLocation correct? basePropertyType:`, basePropertyType);
		else {
			if (typeof selectedPropertyType === "string")
				switch (selectedPropertyType.toLowerCase()) {
					case "string":
						return propertyValue;

					case "number":
						return +propertyValue;

					default:
						if (ConfigCurrent.devMode)
							console.error(`Invalid basePropertyType-string <${basePropertyType}>`);
						return;
				}
			else if (selectedPropertyType instanceof PropertyType) {
				// If the path is not fully resolved, call this function until it is
				if (propertyPath.length) {
					return EntityStorage.parseProperty(selectedPropertyType, propertyPath, propertyValue);
				} else {
					// Otherwise, attempt to parse using a type-specific Parse method
					if (typeof selectedPropertyType.Parse !== "function") {
						if (ConfigCurrent.devMode)
							console.error(`Unregistered Parse function for entity <${selectedPropertyType.typeName}>`);
					} else {
						return selectedPropertyType.Parse(propertyValue);
					}
				}
			} else if (ConfigCurrent.devMode)
				console.error(`Invalid basePropertyType <${basePropertyType}>`);
		}
	}

	/**
	 * Helper function to check if a context can be interpreted as an empty instance of the supplied objectType
	 *
	 * @param {*} cContext
	 * @param {PropertyTypeObject} cObjectType
	 */
	static isEmpty (cContext, cObjectType) {
		for (let propertyName of Object.keys(cObjectType.Properties)) {
			let propertyItem = cObjectType.Properties[propertyName];
			if (typeof propertyItem === "string") {
				if (cContext[propertyName] !== undefined &&
					propertyName !== cObjectType.idProperty)
					return false;
			} else if (propertyItem && propertyItem instanceof PropertyTypeObject) {
				if (cContext[propertyName] && !EntityStorage.isEmpty(cContext[propertyName], propertyItem))
					return false;
			}
		}

		return true;
	}

	/**
	 * Helper function for handling deletion or empty edited entries, i.e. an entry was edited back to the original state
	 *
	 * @param {string[]} namedLocation
	 * @param lastEditContext
	 * @param cLocationPropertyType
	 * @param {boolean} [verbose]
	 * @return {EntityStorage}
	 */
	bubbleUpDeletion (
		namedLocation,
		lastEditContext,
		cLocationPropertyType,
		{
			verbose = ConfigCurrent.devMode
		} = {}
	) {
		let deleteThis = EntityStorage.isEmpty(lastEditContext, cLocationPropertyType);
		if (verbose)
			console.log(`Bubbling up deletion of updated edit entry <${deleteThis ? "TRUE" : "FALSE"}>`);

		if (deleteThis) {
			namedLocation.pop();

			return this.Edit(namedLocation, undefined, STORE_ACTION_TYPE_ENUMERATION.REJECT, verbose);
		} else
			return this;
	}
}

/**
 * Stores references of unique editors, i.e. editors of PropertyType items with only one editor
 * @type {EntityStorageCollection}
 */
let rootEntityStorageCollection = new EntityStorageCollection();

export {
	EntityStorage,
	PropertyType,
	PropertyTypeNone,
	PropertyTypeObject,
	PropertyTypeCollection,
	PropertyConstraint,
	rootEntityStorageCollection
}