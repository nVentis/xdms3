import {
	EntityStorage,
	ENTITY_STATE_ENUMERATIONS,
	PropertyTypeCollection,
} from "./EntityStorage.mjs";
import SyncedPropertyTypeObjectInterface from "./SyncedPropertyTypeObjectInterface.mjs";
import ConfigCurrent from "../../Config/ConfigCurrent.mjs";
import {PropertyTypeObject} from "./EntityStorage.mjs";

class SyncedEntityStorage extends EntityStorage {
	/**
	 *
	 * @inheritDoc
	 */
	constructor(
		collectionType,
		originalCollection = [],
		entityStorageCollection = null) {
		if (!collectionType || !(collectionType.entityType.prototype instanceof SyncedPropertyTypeObjectInterface))
			throw new Error("SyncedEntityStorage requires a collection of SyncedPropertyTypeObjectInterface entities");

		super(collectionType, originalCollection, entityStorageCollection);

		this.Sync = this.Sync.bind(this);
		this.eventSync = this.eventSync.bind(this);
	}

	static SYNC_STRATEGIES = {
		/**
		 * Uses the main SyncedPropertyType for all actions
		 * ie sending only one SyncAction per edited item including all changes in it
		 */
		FULL_TREE: "FULL_TREE",

		/**
		 * Uses the corresponding SyncedPropertyType for any edited property
		 * ie sending one SyncAction per edited item and on SyncAction per edited child that is managed by a SyncedPropertyType
		 */
		SPLIT_TREE: "SPLIT_TREE"
	};

	syncStrategy = "FULL_TREE";

	/**
	 * Recommended way of Syncing changes. Automatically updates EntityStorage state (ie Edits object and lastEditedLocation)
	 * Allows listening for progress events during a Sync action. Possible events:
	 * - progress: One more entity sync step has succeeded
	 * - success: Entity sync completed successfully
	 * - error: An error occured; sync may not be complete; represents an urecoverable state (reload neccessary);
	 * 		after an error, progress events may still be fired, as the sync process is done in parallel fashion and async actions may not be stopped anymore
	 * @param {string} [rootPointer=""]
	 * @return {EventTarget}
	 */
	eventSync (
		rootPointer = "",
		progressAfterError = true
	) {
		let This = this;
		let eventTarget = new EventTarget();

		let syncActions = this.Sync(rootPointer);
		let nSuccessful = 0;
		let nErrored = 0;
		let nTotal = syncActions.length;

		for (let syncAction of syncActions) {
			syncAction.Execute().then(function () {
				nSuccessful++;

				var eventToDispatch;
				if (nTotal === nSuccessful) {
					eventToDispatch = new CustomEvent("success", { detail: {
						nTotal, nSuccessful, nErrored
					}});

					// TODO: Only clear desired part of Edits (as per rootPointer)
					This.clearEdits();
				} else if (!nErrored || progressAfterError) {
					eventToDispatch = new CustomEvent("progress", {
						detail: {
							nTotal, nSuccessful, nErrored
						}
					});
				}

				eventTarget.dispatchEvent(eventToDispatch);
			}, function (errorInfo) {
				nErrored++;

				eventTarget.dispatchEvent(new CustomEvent("error", {
					detail: errorInfo
				}));
			});
		}

		return eventTarget;
	}


	/**
	 * Checks if a certain object is nested (ie if itself has child objects)
	 *
	 * @param someObject
	 * @return {boolean}
	 */
	static isFinal (
		someObject
	) {
		if (!someObject || typeof someObject !== "object")
			return false;

		for (let Key in someObject) {
			if (!SyncedEntityStorage.isFinal(someObject))
				return false;
		}

		return true;
	}

	/**
	 * Automatically syncs all changes using SyncedPropertyType implementations
	 * WARNING: When changing an entity holding multiple references to the same sub entity,
	 * multiple changes to the same sub entity may lead to invalid state
	 * Whenever an invalid state is encountered (ie a failing promise when deleting an entity),
	 * the whole application requires refreshing state through whatever means is used for fetching state
	 * @param {string} [rootPointer=""] - Optional pointer to a sub-tree to sync with an API
	 * @return {SyncAction[]}
	 */
	Sync (
		rootPointer = ""
	) {
		let This = this;

		/**
		 * Fetch the tree of altered entities and create one request per changed (sub)-item
		 * Whenever a property of an entity in the chain is changed, only the directly affected entity
		 * will be updated ie if a User entity has a collection of Friend entites in a sub-collection called Friends and
		 * one of them is to be deleted, only the corresponding action will be executed
		 */

		let [propertyType, diffTree] = this.contextResolveLocal(this.Edits, rootPointer, { returnType: true });
		let sourceTree = this.contextResolveLocal(this.originalCollection, rootPointer, { returnType: false });

		if (!propertyType || !(propertyType.prototype instanceof SyncedPropertyTypeObjectInterface))
			throw new Error(`PropertyType <${propertyType ? propertyType.typeName : "UNKNOWN_TYPE_NAME"}> does not implement SyncedPropertyTypeObjectInterface`);

		// With the PropertyType and corresponding diffTree, we can now create the respective actions

		/**
		 * Analyzes the way entities have been changed (see ENTITY_STATE_ENUMERATIONS) and creates one patchObject items according to SYNC_STRATEGY
		 * Also analyzes all sub entities and collections recursively, iterating through the whole tree
		 * For diffing collections, it's neccessary to also supply the sourceTree (otherwise it is assumed all collection members are inserted; that may lead to
		 * 	unexpected manipulation of collections e.g. when removing is allowed and done for all items persistent in the end point database but not sent with the request)
		 *
		 * @param {Class<SyncedPropertyTypeObjectInterface>} propType
		 * @param diffTree
		 * @param sourceTree
		 * @returns {SyncAction[]}
		 */
		let extendPatchObject = function (
			propType,
			diffTree,
			sourceTree,
			{
				alteredSubCollections,
				alteredOwnProperties,
				alteredSubEntities
			} = {}
		) {
			let entityUpdate = {};
				entityUpdate[propType.idProperty] = diffTree[propType.idProperty];

				console.log("extendPatchObject", propType, diffTree, sourceTree, { alteredSubCollections, alteredOwnProperties, alteredSubEntities });

			if (alteredOwnProperties && alteredOwnProperties.length) {
				/**
				 * alteredOwnProperties are all simple number/string values and choices of possible entities to select
				 * As of now (05.01.2021), it's not expected that a supplied entity was changed
				 */
				for (let [propName, propTypeChild] of alteredOwnProperties) {
					if (typeof propTypeChild === "string") {
						entityUpdate[propName] = diffTree[propName];
					} else {
						entityUpdate[propName] = diffTree[propName][propTypeChild.idProperty];
					}
				}
			}

			// Here, we suspect the same entity as before has been edited (id still the same)
			if (alteredSubEntities && alteredSubEntities.length) {
				for (let [propName, propTypeChild] of alteredSubEntities) {

					let alteredState = getAlteredState(propTypeChild, diffTree[propName]);

					entityUpdate[propName] = extendPatchObject(
						propTypeChild,
						diffTree[propName],
						sourceTree[propName],
						alteredState
					);

					console.log("alteredSubEntities", entityUpdate[propName]);
				}
			}

			// For merging trees including collections, it's neccessary to supply the whole collections (diffing is, in general, not possible)
			// For this, we merge the original collection with the collection supplied in the diffTree
			if (alteredSubCollections && alteredSubCollections.length) {
				for (let [propName, propTypeCollection] of alteredSubCollections) {
					entityUpdate[propName] = [];

					let propTypeEntity = propTypeCollection.entityType;
					let idProperty = propTypeEntity.idProperty;

					// Add all original entities to collection
					if (sourceTree && sourceTree[propName] && sourceTree[propName].length) {
						for (let collectionChild of sourceTree[propName]) {
							// Add original entities to array with removed Id and all direct sub-entities (child compound properties) replaced with their Ids
							let patchedCollectionChild = extendPatchObject(propTypeEntity, collectionChild, null, getAlteredState(propTypeEntity, collectionChild));

							// Remove Id
							// 06.01.2020 - Moved to separate for-loop below

							entityUpdate[propName].push(patchedCollectionChild);
							//entityUpdate[propName].push(collectionChild/*[propTypeEntity.idProperty]*/);
						}
					}

					// Diffing edited against existing items
					if (diffTree[propName].length) {
						for (let editedChild of diffTree[propName]) {
							let entityState = editedChild._STATE;
							let entityId = editedChild[idProperty];

							switch (entityState) {
								case ENTITY_STATE_ENUMERATIONS.DELETED:
								case ENTITY_STATE_ENUMERATIONS.UPDATED:
									let entityChangeCommitted = false;
									for (let i = 0; i < entityUpdate[propName].length; i++) {
										if (entityId === entityUpdate[propName][i][idProperty]) {
											if (entityState === ENTITY_STATE_ENUMERATIONS.UPDATED) {
												// Replace entry with edited entity
												entityUpdate[propName][i] = extendPatchObject(
													propTypeEntity,
													editedChild,
													entityUpdate[propName][i],
													getAlteredState(propTypeEntity, editedChild)
												);
											} else {
												// Remove entry from collection
												entityUpdate[propName].splice(i, 1);
											}

											entityChangeCommitted = true;
											break;
										}
									}

									if (!entityChangeCommitted && ConfigCurrent.devMode)
										console.warn(`Issued commiting change of element non-existent in the original collection. Skipping instruction`);

									break;

								case ENTITY_STATE_ENUMERATIONS.INSERTED:
									// TODO: Consider checking existing entries against this
									let attachedPatchObj = extendPatchObject(
										propTypeEntity,
										editedChild,
										null,
										getAlteredState(propTypeEntity, editedChild)
									);

									if (attachedPatchObj.hasOwnProperty(propTypeEntity.idProperty))
										delete attachedPatchObj[propTypeEntity.idProperty];

									entityUpdate[propName].push(attachedPatchObj);

									break;

								case undefined:
									console.error(editedChild);
									throw new Error(`Stumbled upon unexpected entityState <undefined>, indicating nothing changed`);

								default:
									console.error(editedChild);
									throw new Error(`Stumbled upon unexpected entityState <${entityState}>`);
							}
						}
					} else {
						// Falling back to original values, changing nothing
						console.warn(`Potentially inconsistent diffing encountered`);
						delete entityUpdate[propName];
					}

					// Remove IDs of direct children
					for (let i = 0; i < entityUpdate[propName].length; i++) {
						if (entityUpdate[propName][i].hasOwnProperty(idProperty))
							delete entityUpdate[propName][i][idProperty];
					}

				}
			}

			return entityUpdate;
		}

		/**
		 *
		 *
		 * @param {SyncedPropertyTypeObjectInterface} propType
		 * @param diffTree
		 * @returns {{alteredSubCollections: Array, alteredOwnProperties: Array, alteredSubEntities: Array}}
		 */
		let getAlteredState = function (
			propType,
			diffTree
		) {
			let alteredOwnProperties = [];
			let alteredSubCollections = [];
			let alteredSubEntities = [];

			for (let propName of propType.definedPropertiesWithoutId()) {
				if (diffTree.hasOwnProperty(propName)) {
					let currentSubType = propType.definedProperties[propName].dataType;

					if (typeof currentSubType === "string") {
						alteredOwnProperties.push([propName, currentSubType]);
					} else if (currentSubType.prototype instanceof PropertyTypeObject) {
						// If the sub entity does not have a idProperty attached to it, we assume
						// it's still the same sub entity, but in an somehow edited state

						// TODO: Replace with checking if idProperty exists!
						if (diffTree[propName][currentSubType.idProperty]) {
							console.log("alteredOwnProperty", propName, currentSubType);
							alteredOwnProperties.push([propName, currentSubType]);
						} else {
							console.log("alteredSubEntity", propName, currentSubType);
							alteredSubEntities.push([propName, currentSubType]);
						}
					} else if (
						currentSubType.prototype instanceof PropertyTypeCollection
					) {
						alteredSubCollections.push([propName, currentSubType]);
					} else
						throw new Error(`Encountered unhandled PropertyType <${currentSubType}> with property name <${propName}> as child of <${propType.entityName}>`);
				}
			}

			return {
				alteredOwnProperties,
				alteredSubCollections,
				alteredSubEntities
			}
		}

		/**
		 * Analyzes the way entities have been changed (see ENTITY_STATE_ENUMERATIONS) and creates one/multiple SyncAction items according to SYNC_STRATEGY
		 * Also analyzes all sub entities and collections recursively, iterating through the whole tree
		 * For diffing collections, it's neccessary to also supply the sourceTree (otherwise it is assumed all collection members are inserted; that may lead to
		 * 	unexpected manipulation of collections e.g. when removing is allowed and done for all items persistent in the end point database but not sent with the request
		 *
		 * @param {Class<SyncedPropertyTypeObjectInterface>} propType
		 * @param diffTree
		 * @param sourceTree
		 * @returns {SyncAction[]}
		 */
		let createSyncActions = function (
			propType,
			diffTree,
			sourceTree = null
		) {
			let syncActions = [];

			// When deleting an entity, all child-relations will be handled by the server
			// TODO: Handle deleting an entity AND manually issue deletion of children
			switch (diffTree._STATE) {
				case ENTITY_STATE_ENUMERATIONS.DELETED:
					syncActions.push(new SyncAction(propType, ENTITY_STATE_ENUMERATIONS.DELETED, diffTree));
					break;

				case ENTITY_STATE_ENUMERATIONS.UPDATED:
				case ENTITY_STATE_ENUMERATIONS.INSERTED:
					let alteredState = getAlteredState(propType, diffTree);
					let {
						alteredOwnProperties,
						alteredSubCollections,
						alteredSubEntities
					} = alteredState;

					switch (This.syncStrategy) {
						case SyncedEntityStorage.SYNC_STRATEGIES.SPLIT_TREE:
							if (alteredOwnProperties.length) {
								let entityUpdate = {};

								for (let [propName, propTypeChild] of alteredOwnProperties)
									entityUpdate[propName] = diffTree[propName];

								entityUpdate[propType.idProperty] = diffTree[propType.idProperty];

								syncActions.push(new SyncAction(propType, ENTITY_STATE_ENUMERATIONS.UPDATED, entityUpdate));
							}

							if (alteredSubEntities.length) {
								for (let [propName, propTypeChild] of alteredSubEntities) {
									let syncActionsFromSubEntity = createSyncActions(propTypeChild, diffTree[propName]);
									while (syncActionsFromSubEntity.length)
										syncActions.push(syncActionsFromSubEntity.pop());
								}
							}

							if (alteredSubCollections.length) {
								for (let [propName, propTypeChild] of alteredSubCollections) {
									for (let collectionMember of diffTree[propName]) {
										let syncActionsFromSubCollection = createSyncActions(propTypeChild.entityType, collectionMember);
										while (syncActionsFromSubCollection.length)
											syncActions.push(syncActionsFromSubCollection.pop());
									}
								}
							}

						case SyncedEntityStorage.SYNC_STRATEGIES.FULL_TREE:
							let patchObject = extendPatchObject(
								propType,
								diffTree,
								sourceTree,
								alteredState
							);

							console.log("diffTree", diffTree);
							console.log("patchObject", patchObject);

							syncActions.push(new SyncAction(propType, diffTree._STATE, patchObject));
							break;

						default:
							throw new Error(`Unknown SYNC_STRATEGY <${This.syncStrategy}>`);
					}

					break;

				default:
					throw new Error(`Encountered unknown ENTITY_STATE <${diffTree._STATE}>`);
			}

			return syncActions;
		}

		return createSyncActions(propertyType, diffTree, sourceTree);
	}
}

class SyncAction {
	/**
	 *
	 * @param {Class<SyncedPropertyTypeObjectInterface>} propertyType
	 * @param {string} actionType - As in ENTITY_STATE_ENUMERATIONS
	 * @param {*} entityContent - For DELETE and UPDATE, requires at least a registered key (idProperty)
	 */
	constructor(
		propertyType,
		actionType,
		entityContent
	) {
		this.Execute = function () {
			return new Promise(function (onSuccess, onError) {
				switch (actionType) {
					case ENTITY_STATE_ENUMERATIONS.DELETED:
						return propertyType.Delete(entityContent).then(onSuccess, onError);

					case ENTITY_STATE_ENUMERATIONS.UPDATED:
						return propertyType.Update(entityContent).then(onSuccess, onError);

					case ENTITY_STATE_ENUMERATIONS.INSERTED:
						return propertyType.Insert(entityContent).then(onSuccess, onError);

					default:
						return onError(new Error(`Stumbled upon unknown state <${actionType}>`));
				}
			});
		}

		this.Payload = entityContent;
	}

}

export default SyncedEntityStorage;
export {
	SyncAction
}