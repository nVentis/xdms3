/**
 * UDBI Adapter for IndexedDB
 * @module UDBIAdapters/IDB
 */

import { UDBIDatabase, UDBITable } from "../UDBI/Core.mjs";
import {ObjectManager} from "../UDBI/ObjectManager.mjs";
import InvalidEntityException from "../Exceptions/InvalidEntityException.mjs";
import InvalidStateException from "../Exceptions/InvalidStateException.mjs";
import PersistentStorage from "../Client/PersistentStorage.mjs";
import NotImplementedException from "../Exceptions/NotImplementedException.mjs";
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";
import {EventNamespace} from "../Event/Namespace.mjs";

// For keeping track of IDB versions
let IDBRegister = new PersistentStorage("IDBDatabases");
	IDBRegister.autoLoad = IDBRegister.autoSave = true;

/**
 * Keeps references of all currently open IDb databases
  * @type {Object.<string, IDBDatabase>}
 */
let IDBDatabases = {};

/**
 * Keeps track of version changes and replaces an object manager's database object where required
 * @type {EventNamespace}
 */
let IDBDatabaseManipulator = new EventNamespace("IDBDatabaseManipulator");

/**
 * IDB Provider for nVentis UDBI
 * Copyright 2020 by nVentis (SM), Bryan Bliewert
 * @class
 */

class IDBUDBIDatabase extends UDBIDatabase {
	/**
	 * @constructor
	 * @param {string} dbName Name of the database to be created. Directly maps to name of indexed DB
	 */
	constructor(dbName) {
		super(dbName);

		/** @type {window.indexedDB} **/
		this.dbObject = null;

		/** @type {number} **/
		this.dbVersion = 1;

		/** @type {function} **/
		this.dbErrorHandler = console.log;
	}

	// TODO: Handle onupgrade / DB version changes

	/**
	 * @description Readies the database for operations
	 * @param {number} [versionNumber] - Defaults to 1 per implementation standard
	 * @param {function} [onUpgradeNeeded] - Only used for altering database structure
	 */
	Request(
		versionNumber,
		onUpgradeNeeded
	) {
		let Instance = this;
		return new Promise(function (onSuccess, onError) {
			let requestIndexedDB = function () {
				if (window.indexedDB) {
					let DBOpenRequest = window.indexedDB.open(Instance.dbName, versionNumber);

					if (typeof onUpgradeNeeded === "function")
						DBOpenRequest.onupgradeneeded = function () {
							Instance.dbObject = DBOpenRequest.result;
							Instance.dbVersion = DBOpenRequest.result.version
							Instance.dbObject.onerror = Instance.dbErrorHandler;

							onUpgradeNeeded(Instance);
						};

					DBOpenRequest.onerror = onError;
					DBOpenRequest.onsuccess = function () {
						Instance.dbObject = DBOpenRequest.result;
						Instance.dbVersion = DBOpenRequest.result.version
						Instance.dbObject.onerror = Instance.dbErrorHandler;

						return onSuccess(Instance);
					}
				} else
					return onError("indexedDB not supported by browser");
			}

			if (Instance.Config.Persistence) {
				if (navigator.storage && navigator.storage.persist)
					navigator.storage.persist().then(function (persistent) {
						if (persistent)
							return requestIndexedDB();
						else
							return onError("Storage may be cleared by the UA under storage pressure.");
					});
			}
		});


	}

	/**
	 * @description Lists all stores managed by this provider
	 * @returns {Promise<Array>}
	 */
	Tables() {
		let Instance = this;
		return new Promise(function (onSuccess, onError) {
			return onSuccess(Instance.dbObject.objectStoreNames());
		});
	}

	/**
	 * @description
	 * @param {string} tableName
	 * @param {UDBITableDescriptor} tableDescriptor
	 * @returns {Promise<Database>}
	 */
	tableCreate(tableName, tableDescriptor){
		let Instance = this;
		return new Promise(function (onSuccess, onError) {
			Instance._reconnect(/** @param {Database} UDBIProviderIDB **/ function (UDBIProviderIDB) {
				// Seek until PK is found
				let PKFound = false,
					PKKey,
					Keys = [];
				for (let cKey in tableDescriptor) {
					if (tableDescriptor[cKey].PK) {
						PKFound = cKey;
						Keys.push(cKey);
					}

					if (tableDescriptor[cKey].Key)
						Keys.push(cKey);
				}

				if (!PKFound)
					return onError("Invalid table scheme");

				// Construct createObjectStore object
				let creationObject = {};

				// Use AI if required, otherwise create unique key from PK+Key fields
				if (tableDescriptor[PKKey].AI) {
					creationObject.autoIncrement = true;
					creationObject.keyPath = PKKey;
				} else
					creationObject.keyPath = Keys;

				let Store = Instance.dbObject.createObjectStore(tableName, creationObject),
					Columns = {};

				for (let Key in tableDescriptor) {
					// Skip PK and Key fields
					let cEntry = tableDescriptor[Key];
					if (cEntry.PK || cEntry.Key)
						continue;

					let isUnique = !!cEntry.Key || !!cEntry.Unique;

					Columns[Key] = {
						Index: Store.createIndex("by_" + Key, Key, { unique: isUnique })
					}
				}

				return onSuccess({
					Columns: Columns,
					Store: Store
				});
			}).then(onSuccess, onError);
		});
	}

	/**
	 * @description Reconnects to the current store, and, optionally, allow altering the store structure
	 * @param {function} [onUpgradeNeeded]
	 * @returns {Promise<Database>}
	 */
	_reconnect(onUpgradeNeeded){
		let Instance = this;
		return new Promise(function (onSuccess, onError) {
			if (Instance.dbObject) {
				Instance.dbObject.close();

				if (onUpgradeNeeded && onUpgradeNeeded instanceof Function) {
					return Instance.Request(Instance.dbVersion + 1, onUpgradeNeeded).then(onSuccess, onError);
				} else
					return onSuccess(Instance);
			} else
				return onError("No connection established");
		});
	}
}

/**
 * IDB Table for nVentis UDBI
 * Copyright 2020 by nVentis (SM), Bryan Bliewert
 * @class
 */

class IDBTable extends UDBITable {
	constructor() {
		super();
	}

	/** @inheritDoc */
	Read(a, b){

	}

	/** @inheritDoc */
	Write(a, b){

	}

	/** @inheritDoc */
	Update(a, b){

	}

	/** @inheritDoc */
	Exist(a, b){

	}

	/** @inheritDoc */
	Delete(a, b){

	}
}


/**
 * A class representing a primary to be created for a ManagedEntity
 * @class
 */
class IDBObjectManagerPrimaryKey {
	/**
	 * See https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/createObjectStore#Parameters optionalParameters
	 * @param {string|array} keyPath - If an array key path was supplied, it will be sorted according to alphabet automatically!
	 * @param {boolean} autoIncrement
	 */
	constructor(
		keyPath,
		autoIncrement = false
	) {
		let This = this;

		this.keyPath = keyPath;

		if (this.keyPath && this.keyPath instanceof Array)
			this.keyPath = this.keyPath.sort();

		/**
		 * Returns true if the given Target object matches the primary key property/ies
		 * @param {string|string[]} sortedKeyPath
		 * @returns {boolean}
		 */
		this.keyPathMatches = function (sortedKeyPath) {
			if (This.keyPath instanceof Array) {
				for (let cI = 0; cI < sortedKeyPath.length; cI++)
					if (This.keyPath[cI] !== sortedKeyPath[cI])
						return false;

				return true;
			} else
				return This.keyPath === sortedKeyPath;
		}

		this.autoIncrement = autoIncrement;
	}
}

/**
 * One (out of a custom number) of index descriptors
 * @class
 */
class IDBObjectManagerIndexEntry {
	/**
	 *
	 * @param {string|array} keyPath - In most cases, the property name of a managed entity for which to create an index. For arrays, see Options.
	 * @param {string} [Name=keyPath] - Name of the index to be created. If an array keyPath was supplied, a name is created by sorting the keyPath array
	 *  alphabetically and joining the entries by "_". Any supplied name will be overwritten to ensure consistency
	 * @param {boolean} [isUnique=false]
	 * @param {object} Options - See https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/createIndex#Parameters
	 */
	constructor(
		keyPath,
		Name,
		isUnique = false,
		Options
	) {
		if (typeof Options !== "object")
			Options = {};

		Options.unique = !!isUnique;

		if (keyPath && keyPath instanceof Array) {
			keyPath.sort();
			Name = keyPath.join("_");
		}

		this.keyPath = keyPath;

		this.Name = Name || keyPath;
		this.Options = Options;
	}
}

/**
 * A generic class for use with IDBObjectManager
 * @class
 */
class IDBObjectManagerIndex {
	/**
	 * Represents an index for use with IDBObjectManager
	 * @param {function} ManagedEntity
	 */
	constructor(ManagedEntity) {
		this.ManagedEntity = ManagedEntity;

		/**
		 *
		 * @type {IDBObjectManagerIndexEntry[]}
		 */
		this.Entries = [];

		/**
		 *
		 * @type {Object.<string,IDBObjectManagerIndexEntry>}
		 */
		this.Dictionary = {};
	}
}

/**
 * An index with custom values
 * @class
 */
class IDBObjectManagerCustomIndex extends IDBObjectManagerIndex{
	/**
	 *
	 * @param {function} ManagedEntity
	 * @param {IDBObjectManagerIndexEntry[]} IndexEntries
	 */
	constructor(
		ManagedEntity,
		IndexEntries
	) {
		super(ManagedEntity);

		var This = this;

		IndexEntries.forEach(function (cEntry) {
			if (!(cEntry instanceof IDBObjectManagerIndexEntry))
				throw new InvalidEntityException("cEntry");

			This.Entries.push(cEntry);
			This.Dictionary[cEntry.Name] = cEntry;
		});
	}
}

/**
 * A general-purpose index for use with IDBObjectManager. Uses one auto-incrementing ID field with custom name, and allows further ID entries
 * @class
 */
class IDBObjectManagerGeneratedIndex extends IDBObjectManagerIndex{
	/**
	 * Will create an index based on supplied properties. When using this index, they are assumed all to be not unique
	 * @param {function} ManagedEntity
	 * @param {array} Properties - All entries are interpreted as name and keyPath values of the index to be created
	 */
	constructor(
		ManagedEntity,
		Properties
	) {
		super(ManagedEntity);

		var This = this;
		this.ManagedEntity = ManagedEntity;

		Properties.forEach(function (cProperty) {
			This.Entries.push(new IDBObjectManagerIndexEntry(cProperty, cProperty));
		});

		this.Entries;
	}
}

/**
 * Contains database schema information as well as the database project itself
 * @class
 */
class IDBDatabaseReference {
	constructor(databaseName) {
		this.addSchema = function () {

		}

	}
}

class IDBObjectManager extends ObjectManager {
	/**
	 *
	 * @param {function} ManagedEntity
	 * @param {string} databaseName
	 * @param {IDBObjectManagerPrimaryKey} [PrimaryKey] - Only used when database is created
	 * @param {IDBObjectManagerIndex} [Index] - Only used when database is created
	 */
	constructor(
		ManagedEntity,
		databaseName,
		PrimaryKey,
		Index
	) {
		super(ManagedEntity, ManagedEntity.name);

		let Manager = this;

		/** @type {string} */
		this.dbName = databaseName;

		/** @type {IDBDatabase} **/
		this.dbObject = null;

		// /** @type {IDBObjectStore} */
		// this.dbStore = null;

		/** @type {number} **/
		this.dbVersion = 1;

		/** @type {function} **/
		this.dbErrorHandler = console.log;

		/** @type {boolean} */
		this.Persistence = true;

		/**
		 * @type {IDBObjectManagerPrimaryKey}
		 */
		this.PrimaryKey = PrimaryKey;

		/**
		 * @type {IDBObjectManagerIndex}
		 */
		this.Index = Index;

		/**
		 *
		 * @param {IDBDatabase|undefined} [IDBInstance]
		 * @returns {Promise<IDBObjectManager>}
		 */
		this.Request = async function (IDBInstance) {
			await IDBRegister.Load();

			if (IDBInstance && IDBInstance.name !== databaseName)
				return new InvalidStateException("IDBInstance");

			/**
			 * Called when the database is ready for use. Also attaches
			 * a handler for when the database to be replaced in order
			 * to allow JIT upgrades
			 * @param {IDBDatabase} IDBInstance
			 * */
			let Finalize = function (IDBInstance) {
				return new Promise(function (onSuccess, onError) {
					let cVersion = IDBInstance.version;

					Manager.dbObject = IDBInstance;
					Manager.dbVersion = IDBInstance.version;
					Manager.dbObject.onerror = Manager.dbErrorHandler;
					Manager.dbObject.onversionchange = function () {
						//console.log("VersionChange");
						// Subscribe for new database available
						IDBDatabaseManipulator.When(
							"dbUpgrade",
							function (IDBInstance) {
								Finalize(IDBInstance).then(function () {
									console.log("Updated IDB reference");
								}, console.log);
							},
							true,
							/**
							 * Only update if current database is upgraded
							 * @param {IDBDatabase} IDBInstance
							 */
							function (IDBInstance) {
								return (
									IDBInstance.name === databaseName &&
									IDBInstance.version !== cVersion
								);
							}
						);

						// Save unsaved data and close db (to allow further upgrades)
						// Other function execution (adding new stores etc.) will only continue after this!
						Manager.Flush().then(function () {
							Manager.dbObject.close();
						}, function (errorInfo) {
							console.log(errorInfo);
							Manager.dbObject.close();
						});
					}

					IDBRegister.Set(databaseName, Manager.dbVersion).then(function () {
						IDBDatabases[databaseName] = IDBInstance;
						return onSuccess(Manager);
					}, onError);
				});
			}

			let setupIDB = function (event) {
				/** @type {IDBObjectStore} */
				let IDB = event.target.result;
				IDB.onerror = Manager.dbErrorHandler;

				/** @type {IDBObjectStore} */
				let objectStore = IDB.createObjectStore(Manager.Name, PrimaryKey),
					indexEntries = Index.Entries;

				for (let cI = 0; cI < indexEntries.length; cI++) {
					/** @type {IDBObjectManagerIndexEntry} */
					let cEntry = indexEntries[cI];

					// Throw error if a compund index uses the primary key value
					// This is not allowed per specification, create a separate property+index for
					// this purpose (12.04.2020)
					if (
						/* index string, PK string */ cEntry.keyPath === "string" && PrimaryKey.keyPathMatches(cEntry.keyPath) ||
						/* index array, PK string */ (cEntry.keyPath instanceof Array && typeof PrimaryKey.keyPath === "string" && cEntry.keyPath.includes(PrimaryKey.keyPath)) ||
						/* index array, PK array */ JSON.stringify(cEntry.keyPath) === JSON.stringify(PrimaryKey.keyPath)
					)
						throw new InvalidStateException("cEntry");

					objectStore.createIndex(cEntry.Name, cEntry.keyPath, cEntry.Options);
				}
			}

			/**
			 *
			 * @param {IDBDatabase} IDBInstance
			 * @param {number} [versionNumber] - When not supplied, will automatically either assume to continue the existing version
			 *  number of automatically increase it in order to create a new store managing ManagedEntity
			 *  @returns {Promise<IDBObjectManager>}
			 */
			let requestIndexedDB = function (IDBInstance, versionNumber) {
				return new Promise(function (onSuccess, onError) {
					if (window.indexedDB) {
						// Check if reference to IDB database already exists - use that if possible
						if (IDBDatabases[databaseName] && !IDBInstance)
							IDBInstance = IDBDatabases[databaseName];

						//console.log([IDBInstance, versionNumber]);

						if (versionNumber) {
							let DBOpenRequest = window.indexedDB.open(databaseName, versionNumber);
							//console.log("Version number supplied [" + versionNumber + "]");

							/*
							setInterval(function () {
								console.log(DBOpenRequest);
							}, 2000);
							*/

							DBOpenRequest.onupgradeneeded = setupIDB;
							DBOpenRequest.onerror = onError;
							DBOpenRequest.onsuccess = function () {
								return Finalize(DBOpenRequest.result).then(function (Manager) {
									//console.log(Manager);
									return onSuccess(Manager);
								}, onError);
							};
						} else {
							// Check if an IDB instance is already supplied
							// If yes, check if it already contains this store
							// If yes, finish
							// If not, execute requestIndexDB again, but with the current versionNumber + 1, indicating an update
							// If not, retrieve the current version from localStorage

							if (IDBInstance && (IDBInstance instanceof IDBDatabase)) {
								let currentStores = IDBInstance.objectStoreNames;
								//console.log([currentStores, Manager.Name]);
								if (currentStores.contains(Manager.Name)) {
									//console.log("Setting dbVersion to [" + IDBInstance.version + "]");

									return Finalize(IDBInstance).then(onSuccess, onError);
								} else {
									// Database exists but store does not - Update (version change) required
									// Also issue an Upgrade event to update existing ObjectManagers
									//console.log("Increasing version number from [" + IDBInstance.version + "] to [" + (IDBInstance.version + 1) + "]");
									return requestIndexedDB(IDBInstance, IDBInstance.version + 1).then(function () {
										IDBDatabaseManipulator.Then("dbUpgrade", Manager.dbObject).then(function () {
											return onSuccess(Manager);
										});
									}, onError);
								}
							} else {
								IDBRegister.Get(databaseName).then(function (currentVersion) {
									//console.log("currentVersion [" + currentVersion + "]");
									currentVersion = currentVersion || 1;
									//console.log("currentVersion [" + currentVersion + "]");

									return requestIndexedDB(null, currentVersion).then(onSuccess, onError);
								}, onError);
							}
						}
					} else
						return onError(new InvalidStateException("indexedDB not supported by browser"));
				});
			}

			if (Manager.Persistence) {
				if (navigator.storage && navigator.storage.persist) {
					var persistent = await navigator.storage.persist();
					if (persistent)
						return await requestIndexedDB(IDBInstance);
					else
						throw new InvalidStateException("navigator.storage.persist");
				}
			}
		}

		/**
		 * @type {QueueEntry[]}
		 */
		let Queue = [];

		/**
		 * An entry in the ORM queue
		 * @param {object} ManagableEntityInstance
		 * @param {number} Type - 0: Delete, 1: Put
		 * @constructor
		 */
		let QueueEntry = function (
			ManagableEntityInstance,
			Type
		) {
			this.EntityInstance = ManagableEntityInstance;
			this.Type = Type;
		}

		const
			QUEUE_ENTRY_TYPE_DELETE = 0,
			QUEUE_ENTRY_TYPE_PUT = 1,
			QUEUE_ENTRY_TYPE_ADD = 2;

		/**
		 * Prepares an instance of ManageableEntity for update/addition to the database. Use .Flush() to apply changes
		 * @param {object} ManagableEntityInstance - Will be checked for valid primary key, if possible. I.e., if autoIncrement was selected,
		 *  but the object contains a property with the same name, it will be deleted so the database can keep track of ID generation.
		 * @returns {Promise<boolean>}
		 */
		this.Persist = async function (ManagableEntityInstance) {
			if (!(ManagableEntityInstance instanceof Manager.ManagedEntity))
				throw new InvalidEntityException("ManagableEntityInstance");

			// TODO: Fix PrimaryKey multi-key entries
			if (Manager.PrimaryKey.autoIncrement && Manager.PrimaryKey.keyPath) {
				if (typeof Manager.PrimaryKey.keyPath === "string") {
					// ...only delete the property if its not valid
					if (typeof ManagableEntityInstance[Manager.PrimaryKey.keyPath] !== "number")
						delete ManagableEntityInstance[Manager.PrimaryKey.keyPath];
				} else if (Manager.PrimaryKey.keyPath instanceof Array) {
					// TODO: Handle multi-entry keyPath entries
					throw new NotImplementedException("keyPath Array");
				} else
					throw new InvalidTypeException("keyPath");
			}

			// Remove all functions
			for (let Property in ManagableEntityInstance)
				if (typeof ManagableEntityInstance[Property] === "function")
					delete ManagableEntityInstance[Property];

			Queue.push(new QueueEntry(
				ManagableEntityInstance,
				QUEUE_ENTRY_TYPE_PUT
			));

			return true;
		}

		/**
		 * Create an instance of the ManagedEntity. Note that its constructor may be designed to support this (otherwise: set via supplied PrimaryKey?)
		 * @param PrimaryKeyValue
		 * @returns {object}
		 */
		this.getReference = function (PrimaryKeyValue) {
			let ManagedEntityInstance = new Manager.ManagedEntity();
			Manager._setPrimaryKeyValue(ManagedEntityInstance, PrimaryKeyValue);

			return ManagedEntityInstance;
		}

		/**
		 * Helper method for getting the PrimaryKey of an entity
		 * @param {object} ManagableEntityInstance
		 * @returns {*}
		 */
		this._getPrimaryKeyValue = function (ManagableEntityInstance) {
			if (!(ManagableEntityInstance instanceof ManagedEntity))
				throw new InvalidEntityException("ManagableEntityInstance");

			let PKKeyPath = PrimaryKey.keyPath;

			if (!(PKKeyPath instanceof Array)) {
				return ManagableEntityInstance[PKKeyPath];
			} else
				throw new NotImplementedException("PKKeyPath Array");
		}

		/**
		 * Helper method for setting the PrimaryKey of an entity
		 * @param {object} ManagableEntityInstance
		 * @param PrimaryKeyValue
		 */
		this._setPrimaryKeyValue = function (ManagableEntityInstance, PrimaryKeyValue) {
			if (!(ManagableEntityInstance instanceof ManagedEntity))
				throw new InvalidEntityException("ManagableEntityInstance");

			let PKKeyPath = PrimaryKey.keyPath;

			if (!(PKKeyPath instanceof Array)) {
				ManagableEntityInstance[PKKeyPath] = PrimaryKeyValue;
			} else
				throw new NotImplementedException("PKKeyPath Array");
		}


		/**
		 * Executes the queue and adds/updates all pending changes to the database
		 * @returns {Promise<boolean>}
		 */
		this.Flush = async function () {
			if (!Queue.length)
				return true;

			// Create Promises array from queue
			let Promises = Queue.map(function (cQueueEntry) {
				return new Promise(function (onSuccess, onError) {
					let cTransaction = Manager.dbObject.transaction(Manager.Name, "readwrite"),
						storeObject = cTransaction.objectStore(Manager.Name),
						ManagedEntityInstance = cQueueEntry.EntityInstance,
						Type = cQueueEntry.Type,
						Request;

					if (Type === 0) // .delete() requires a primary key value to be supplied - get this using _getPrimaryKeyValue(); these are checked already before in Delete()
						Request = storeObject.delete(Manager._getPrimaryKeyValue(ManagedEntityInstance));
					else if (Type === 1)
						Request = storeObject.put(ManagedEntityInstance);
					else if (Type === 2)
						Request = storeObject.add(ManagedEntityInstance);
					else
						return onError("Invalid Type");

					Request.onsuccess = onSuccess;
					Request.onerror = onError;
				});
			});

			// Clear queue
			Queue.length = 0;

			for (const cPromise of Promises) {
				let cPromiseResult = await cPromise;
				if (!cPromiseResult)
					return false;
			}

			return true;
		}


		let capitalize = function (str) {
			return str.charAt(0).toUpperCase() + str.slice(1);
		}

		/**
		 * Retrieves the name of the index associated to the requested properties (especially important for multi condition queries).
		 * Returns null only if the primary key matches the requested properties
		 * @param {object} Target
		 * @returns {null|undefined|string} - Null for PrimaryKey. string for an index name. undefined otherwise (non-existent)
		 */
		this.targetObjectToIndexSource = function (Target) {
			// If the PrimaryKey was created using a keyPath, see if that suffices
			if (/*PrimaryKey.keyPath &&*/ PrimaryKey.keyPathMatches(Target)) {
				return null;
			} else {
				// See if an index using the expected name exists
				let Properties = Object.keys(Target).sort(),
					expectedIndexName = Properties.join("_");

				if (Index.Dictionary[expectedIndexName]) {
					return expectedIndexName;
				} else
					return undefined;
			}
		}

		let
			/**
			 * Helper function to construct the ManagedEntity using data loaded from the database
			 * @param {object} entityData
			 * @returns {object}
			 */
			constructEntitiy = function (entityData) {
				let EntityInstance = new ManagedEntity();
				for (let Property in entityData) {
					// Use setter function (if possible)
					if (typeof EntityInstance["set" + capitalize(Property)] === "function")
						EntityInstance["set" + capitalize(Property)](entityData[Property]);
					else
						EntityInstance[Property] = entityData[Property];
				}

				return EntityInstance;
			},
			/**
			 * Array variant of constructEntity
			 * @param {Object[]} entityDataArray
			 * @returns {Object[]}
			 */
			constructEntities = function (entityDataArray) {
				return entityDataArray.map(constructEntitiy);
			};

		/** @inheritDoc */
		this.findBy = function (
			Target,
			orderDesc,
			Limit,
			getPrimaryKeyOnly = false // TODO: Implement this using openKeyCursor
		) {
			return new Promise(function (onSuccess, onError) {
				// Sorting properties is crucial
				let targetKeys = Object.keys(Target);
					targetKeys.sort();

				if (!targetKeys.length)
					return onError(new InvalidTypeException("Target"));

				// If only one property is selected, use getAll
				let Request;
				if (targetKeys.length === 1) {
					let sourceObject,
						Field = targetKeys[0],
						Value = Target[targetKeys[0]];

					// console.log([Field, PrimaryKey.keyPath, Index.Dictionary]);
					if (Field === PrimaryKey.keyPath) {
						// Search directly on the primary key using IDBStore.getAll()
						let cTransaction = Manager.dbObject.transaction(Manager.Name, "readonly"),
							storeObject = cTransaction.objectStore(Manager.Name);

						sourceObject = storeObject;
					} else if (Index.Dictionary[Field]) {
						let cIndexEntry = Index.Dictionary[Field],
							cTransaction = Manager.dbObject.transaction(Manager.Name, "readonly"),
							storeObject = cTransaction.objectStore(Manager.Name),
							indexObject = storeObject.index(cIndexEntry.Name);

						//console.log([cIndexEntry.Name, Field, Value]);

						sourceObject = indexObject;
					} else
						return onError(new InvalidTypeException("Field"));

					Request = sourceObject.getAll(Value, Limit);
					Request.onerror = onError;
					Request.onsuccess = function () {
						// console.log([a, Request]);
						if (typeof Request.result !== "undefined" &&
							Request.result !== null) {
							//console.log(Request.result);
							if (!(Request.result instanceof Array))
								return onSuccess(constructEntities([Request.result]));
							else
								return onSuccess(constructEntities(Request.result));
						} else
							return onSuccess([]);
					}

				} else {
					let cQuery = new IDBObjectQuery({
						Exact: Target,
						Limit: Limit
					});

					return cQuery.Resolve().then(onSuccess, onError);
				}
			});
		}

		/**
		 * Parses a target object into a form IndexedDB can directly handle
		 * @param {object|string|number} targetObject
		 * @returns {[]|string|number}
		 */
		let parseTargetValue = function (targetObject) {
			let	targetKeys = Object.keys(targetObject);
				targetKeys.sort();

			if (targetKeys.length === 1) {
				return targetObject[targetKeys[0]]
			} else {
				let valueArray = []
				for (let cI = 0; cI < targetKeys.length; cI++)
					valueArray.push(targetObject[targetKeys[cI]]);

				return valueArray;
			}
		}

		/**
		 * @typedef {object} queryDefinition
		 * @property {object} [Exact]
		 * @property {object} [Lower]
		 * @property {object} [Upper]
		 * @property {boolean} [includeLower=true]
		 * @property {boolean} [includeUpper=true]
		 * @property {number} [Limit]
		 */

		/**
		 * A helper class for executing basic IDB selection operations
		 * @class
		 */
		class IDBObjectQuery {
			/**
			 * @param {queryDefinition} Definition
			 */
			constructor(Definition) {
				var This = this;

				if (!Definition)
					throw new InvalidTypeException("Definition");

				if (typeof Definition.includeLower === "undefined")
					Definition.includeLower = true;

				if (typeof Definition.includeUpper === "undefined")
					Definition.includeUpper = true;

				this.Definition = Definition;

				/**
				 * @type {IDBKeyRange}
				 */
				this.keyRange = null;

				if (Definition.Exact)
					this.keyRange = IDBKeyRange.only(parseTargetValue(Definition.Exact));
				else if (Definition.Lower) {
					if (Definition.Upper)
						this.keyRange = IDBKeyRange.bound(
							parseTargetValue(Definition.Lower),
							parseTargetValue(Definition.Upper),
							!Definition.includeLower,
							!Definition.includeUpper
						);
					else
						this.keyRange = IDBKeyRange.lowerBound(
							parseTargetValue(Definition.Lower),
							!Definition.includeLower
						);
				} else if (Definition.Upper)
					this.keyRange = IDBKeyRange.upperBound(
						parseTargetValue(Definition.Upper),
						!Definition.includeUpper
					);
				else
					throw new InvalidTypeException("Definition");

				// Construct index / source name
				this.dataSource = Manager.targetObjectToIndexSource(Definition.Exact || Definition.Lower || Definition.Upper);
				this.Resolve = function () {
					return Manager.resolveQuery(This);
				}
				this.Limit = Definition.Limit;
			}
		}
		this.Query = IDBObjectQuery;

		/**
		 * Attempts to resolve a Manager.Query
		 * @param {IDBObjectQuery} Query
		 * @returns {Promise<object[]>}
		 */
		this.resolveQuery = function (Query) {
			return new Promise(function (onSuccess, onError) {
				let dataSource = Query.dataSource,
					Limit = Query.Limit,
					Request;

				// Requires multi-entry key path setup for this exact query
				// Uses IDBKeyRange()
				if (dataSource === undefined)
					return onError(new InvalidStateException("dataSource"));
				else {
					let cTransaction = Manager.dbObject.transaction(Manager.Name, "readonly"),
						storeObject = cTransaction.objectStore(Manager.Name);

					if (dataSource === null) {
						// Search in PrimaryKey
						Request = storeObject.openCursor(Query.keyRange);
					} else {
						// Search in given index
						let indexName = dataSource,
							indexObject = storeObject.index(indexName);

						Request = indexObject.openCursor(Query.keyRange);
					}
				}

				let Results = [];
				Request.onerror = onError;
				Request.onsuccess = function (e) {
					/** @type {IDBCursor} */
					const cursor = e.target.result;

					if (cursor) {
						Results.push(cursor.value);

						if (typeof Limit !== "number" || Results.length < Limit)
							return cursor.continue();
						else
							return onSuccess(constructEntities(Results));

					} else
						return onSuccess(constructEntities(Results));
				};
			});
		}

		/**
		 * Deletes an existing object from the store
		 * @param {object} ManagedEntityInstance
		 * @returns {Promise<boolean>}
		 */
		this.Delete = async function (ManagedEntityInstance) {
			if (!(ManagedEntityInstance instanceof Manager.ManagedEntity))
				throw new InvalidEntityException("ManagedEntityInstance");

			let PKValue = Manager._getPrimaryKeyValue(ManagedEntityInstance);
			if (PKValue === undefined)
				throw new InvalidStateException("ManagedEntityInstance PK")

			Queue.push(new QueueEntry(
				ManagedEntityInstance,
				QUEUE_ENTRY_TYPE_DELETE
			));

			return true;
		}




	}
}

export {
	IDBUDBIDatabase,
	IDBTable,
	IDBObjectManager,
	IDBObjectManagerIndex,
	IDBObjectManagerIndexEntry,
	IDBObjectManagerCustomIndex,
	IDBObjectManagerGeneratedIndex,
	IDBObjectManagerPrimaryKey
}