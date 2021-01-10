import {EntityStorage} from "./EntityStorage.mjs";
import InvalidStateException from "../../Exceptions/InvalidStateException.mjs";

class EntityStorageCollection {
	/**
	 * @type {object<string, EntityStorage>}
	 */
	Storages = {};

	/**
	 * @param {EntityStorage} entityStorage
	 * @param {string} [Alias] - Will default to name of PropertyType
	 * @returns {EntityStorageCollection}
	 */
	addStorage (
		entityStorage,
		Alias
	) {
		if (typeof Alias !== "string")
			Alias = entityStorage.collectionType.typeName;

		if (this.Storages[Alias])
			throw new InvalidStateException(`this.Storages<${Alias}> exists`);

		this.Storages[Alias] = entityStorage;

		return this;
	}

	constructor(

	) {

	}
}

export default EntityStorageCollection;