import SyncedPropertyTypeObjectInterface from "./SyncedPropertyTypeObjectInterface.mjs";

/**
 * Processes a diffed entity and compiles a function to sequentally execute all associated actions
 * Use case:
 * 	Input:
 * 	- a SyncedPropertyTypeObjectInterface with all compound sub-entities also inheriting from that interface
 * 	- a tree including all diffed properties as managed by EntityStorage (output using )
 */
class EntityDiffRequest {
	/**
	 *
	 * @param rootType
	 * @param diffedEntityTree
	 */
	constructor(
		rootType,
		diffedEntityTree
	) {
	}
}

export default EntityDiffRequest;